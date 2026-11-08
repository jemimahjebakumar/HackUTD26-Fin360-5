export type Profile = {
  monthly_income: number;
  monthly_expenses: number;
  savings: number;
  debt: number;
};
export type Decision = {
  title: string;
  category: string;
  monthly_cost_change: number;
  one_time_cost: number;
  notes?: string;
};
export type Context = { profile: Profile | null; decisions: Decision[] };
export type Scenario = { monthly_cost_change: number; one_time_cost: number };

export function monthlyNet(ctx: Context, extra?: Scenario) {
  if (!ctx.profile) return undefined;
  const delta =
    ctx.decisions.reduce((s, d) => s + d.monthly_cost_change, 0) +
    (extra?.monthly_cost_change ?? 0);
  return ctx.profile.monthly_income - ctx.profile.monthly_expenses - delta;
}

export function projectFinances(ctx: Context, months: number, extra?: Scenario, annualReturn = 0.04) {
  if (!ctx.profile) return { error: "No profile saved yet. Ask the user to fill in their profile." };

  const net = monthlyNet(ctx, extra)!;
  const oneTime =
    ctx.decisions.reduce((s, d) => s + d.one_time_cost, 0) + (extra?.one_time_cost ?? 0);
  const r = annualReturn / 12;

  let savings = ctx.profile.savings - oneTime;
  const timeline: { month: number; savings: number }[] = [];
  for (let m = 1; m <= months; m++) {
    savings = savings * (1 + r) + net;
    if (m % 6 === 0 || m === months) timeline.push({ month: m, savings: Math.round(savings) });
  }

  return {
    monthlyNetCashflow: Math.round(net),
    endingSavings: Math.round(savings),
    goesNegative: timeline.some((t) => t.savings < 0),
    assumptions: `${(annualReturn * 100).toFixed(1)}% annual return on savings, flat income and expenses, debt not modeled`,
    timeline,
  };
}