
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles insertable by owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles updatable by owner" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '💸',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups select own" ON public.groups FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Groups insert own" ON public.groups FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Groups update own" ON public.groups FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Groups delete own" ON public.groups FOR DELETE USING (auth.uid() = owner_id);

-- Participants (includes the primary user as a participant row with is_owner=true)
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#10b981',
  is_owner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_participants_group ON public.participants(group_id);
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants select" ON public.participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
CREATE POLICY "Participants insert" ON public.participants FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
CREATE POLICY "Participants update" ON public.participants FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
CREATE POLICY "Participants delete" ON public.participants FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.participants ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT DEFAULT 'general',
  split_mode TEXT NOT NULL DEFAULT 'equal' CHECK (split_mode IN ('equal','custom','percentage')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_group ON public.expenses(group_id);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Expenses select" ON public.expenses FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
CREATE POLICY "Expenses insert" ON public.expenses FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
CREATE POLICY "Expenses update" ON public.expenses FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
CREATE POLICY "Expenses delete" ON public.expenses FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));

-- Expense splits
CREATE TABLE public.expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants ON DELETE CASCADE,
  share_amount NUMERIC(12,2) NOT NULL CHECK (share_amount >= 0)
);
CREATE INDEX idx_splits_expense ON public.expense_splits(expense_id);
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Splits select" ON public.expense_splits FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.expenses e JOIN public.groups g ON g.id = e.group_id WHERE e.id = expense_id AND g.owner_id = auth.uid()));
CREATE POLICY "Splits insert" ON public.expense_splits FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e JOIN public.groups g ON g.id = e.group_id WHERE e.id = expense_id AND g.owner_id = auth.uid()));
CREATE POLICY "Splits update" ON public.expense_splits FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.expenses e JOIN public.groups g ON g.id = e.group_id WHERE e.id = expense_id AND g.owner_id = auth.uid()));
CREATE POLICY "Splits delete" ON public.expense_splits FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.expenses e JOIN public.groups g ON g.id = e.group_id WHERE e.id = expense_id AND g.owner_id = auth.uid()));
