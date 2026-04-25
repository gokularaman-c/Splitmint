import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, Wallet, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-mint shadow-mint">
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">SplitMint</span>
        </div>
        <div className="flex gap-2">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth"><Button className="bg-gradient-mint text-primary-foreground shadow-mint hover:opacity-90">Get started</Button></Link>
        </div>
      </header>

      <section className="container mx-auto px-6 pt-16 pb-24 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm shadow-soft">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">Powered by MintSense AI</span>
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          Split expenses,<br />
          <span className="bg-gradient-hero bg-clip-text text-transparent">beautifully balanced.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Your gateway to Karbon. Track group spending, see who owes whom, and settle up in the fewest possible payments.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-mint text-primary-foreground shadow-mint hover:opacity-90">
              Start splitting free
            </Button>
          </Link>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-4 md:grid-cols-3">
          {[
            { icon: Users, title: "Groups & Friends", desc: "Up to 4 people per group with custom names and colors." },
            { icon: TrendingUp, title: "Smart Balances", desc: "Auto-computed net balances and minimal settlements." },
            { icon: Sparkles, title: "MintSense AI", desc: "Add expenses with natural language and get smart summaries." },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl border border-border bg-gradient-card p-6 text-left shadow-card">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
