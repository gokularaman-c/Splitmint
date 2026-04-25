// Balance computation & minimal settlement engine
export type Participant = { id: string; name: string; color?: string | null; is_owner?: boolean };
export type ExpenseRow = {
  id: string;
  payer_id: string;
  amount: number;
  description: string;
  expense_date: string;
  splits: { participant_id: string; share_amount: number }[];
};

export type Balance = { participantId: string; net: number };
export type Settlement = { fromId: string; toId: string; amount: number };

export function computeNetBalances(participants: Participant[], expenses: ExpenseRow[]): Map<string, number> {
  const net = new Map<string, number>();
  participants.forEach((p) => net.set(p.id, 0));
  for (const e of expenses) {
    net.set(e.payer_id, (net.get(e.payer_id) ?? 0) + Number(e.amount));
    for (const s of e.splits) {
      net.set(s.participant_id, (net.get(s.participant_id) ?? 0) - Number(s.share_amount));
    }
  }
  // Round to cents
  for (const [k, v] of net) net.set(k, Math.round(v * 100) / 100);
  return net;
}

export function minimalSettlements(net: Map<string, number>): Settlement[] {
  const debtors: { id: string; amt: number }[] = [];
  const creditors: { id: string; amt: number }[] = [];
  for (const [id, v] of net) {
    if (v < -0.009) debtors.push({ id, amt: -v });
    else if (v > 0.009) creditors.push({ id, amt: v });
  }
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);
  const out: Settlement[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    const amount = Math.round(pay * 100) / 100;
    if (amount > 0) out.push({ fromId: debtors[i].id, toId: creditors[j].id, amount });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return out;
}

export function computeSplits(
  amount: number,
  participantIds: string[],
  mode: "equal" | "custom" | "percentage",
  values?: Record<string, number>,
): { participant_id: string; share_amount: number }[] {
  const cents = Math.round(amount * 100);
  if (mode === "equal") {
    const base = Math.floor(cents / participantIds.length);
    let rem = cents - base * participantIds.length;
    return participantIds.map((id) => {
      const extra = rem > 0 ? 1 : 0;
      if (rem > 0) rem--;
      return { participant_id: id, share_amount: (base + extra) / 100 };
    });
  }
  if (mode === "percentage") {
    const totals = participantIds.map((id) => Math.round(((values?.[id] ?? 0) / 100) * cents));
    const diff = cents - totals.reduce((a, b) => a + b, 0);
    if (totals.length) totals[0] += diff;
    return participantIds.map((id, i) => ({ participant_id: id, share_amount: totals[i] / 100 }));
  }
  // custom
  return participantIds.map((id) => ({ participant_id: id, share_amount: Math.round((values?.[id] ?? 0) * 100) / 100 }));
}

export function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
