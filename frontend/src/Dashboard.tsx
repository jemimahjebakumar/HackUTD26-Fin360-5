// folio dashboard — everything in one file. Needs: react, lucide-react, tailwindcss v4.
import { useState, type ReactNode } from "react";
import { Bell, Leaf, MessageCircle, Send, Sparkles, X, TrendingUp, AlertTriangle, PartyPopper } from "lucide-react";

/* ================= MOCK DATA (swap for backend) ================= */
const totals = { netWorth: 348000, assets: 602000, liabilities: -254000 };

const accounts = [
  { name: "Everyday Checking", type: "Checking", institution: "Capital One", balance: 12800, deposits: 6200, withdrawals: -4000, cashFlow: 2200 },
  { name: "High-yield Savings", type: "Savings", institution: "Ally", balance: 30000, deposits: 800, withdrawals: 0, cashFlow: 800 },
];

const recurring = [
  { name: "Mortgage", category: "Housing", total: 1870 },
  { name: "Car loan", category: "Auto", total: 325 },
  { name: "Student loan", category: "Education", total: 280 },
  { name: "Spotify", category: "Subscription", total: 11.99 },
  { name: "Netflix", category: "Subscription", total: 15.49 },
  { name: "Gym", category: "Health", total: 45 },
];

const alerts = [
  { tone: "warn" as const, title: "Dining is up 32%", body: "You spent $412 on restaurants this month vs. a $312 average." },
  { tone: "good" as const, title: "Paycheck went up", body: "Your last two deposits were $180 higher than usual." },
];

const projection = [42800, 44100, 45900, 47200, 49600, 51200];

const investments = [
  { name: "Brokerage", type: "Individual", institution: "Fidelity", value: 48200, contributions: 40200, gain: 8000 },
  { name: "Roth IRA", type: "Retirement", institution: "Vanguard", value: 24000, contributions: 19600, gain: 4400 },
  { name: "401(k)", type: "Retirement", institution: "Empower", value: 55000, contributions: 46000, gain: 9000 },
];

const holdings = [
  { ticker: "VTI", name: "Total Stock Market", shares: 120, pct: 38 },
  { ticker: "AAPL", name: "Apple", shares: 45, pct: 14 },
  { ticker: "VXUS", name: "Intl Stock", shares: 160, pct: 18 },
  { ticker: "BND", name: "Total Bond", shares: 140, pct: 16 },
  { ticker: "MSFT", name: "Microsoft", shares: 22, pct: 14 },
];

const assets = [
  { name: "Your home", detail: "Single-family · Austin, TX", value: 410000, change: "+4.1% this year" },
  { name: "2022 Toyota RAV4", detail: "Vehicle · 31k miles", value: 22000, change: "−8% this year" },
];

const loans = [
  { name: "Home mortgage", type: "Mortgage", principal: 320000, remaining: 248000, owed: 251200, rate: "6.25% fixed", payoff: "Sep 2051", pctPaid: 22, monthly: 1870 },
  { name: "Auto loan", type: "Auto", principal: 25000, remaining: 6000, owed: 6150, rate: "4.9% fixed", payoff: "Jun 2027", pctPaid: 76, monthly: 325 },
];

// Profile sent to the AI server (swap for real user data or a profile form).
const profile: Profile = {
  monthly_income: 6200,   // checking deposits this month
  monthly_expenses: 4000, // checking withdrawals this month
  savings: accounts.reduce((sum, a) => sum + a.balance, 0),
  debt: loans.reduce((sum, l) => sum + l.owed, 0),
};

const usd = (n: number) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: n % 1 ? 2 : 0 });

/* ================= CONFETTI (no install needed) ================= */
const CONFETTI_COLORS = ["#2f6b4f", "#57a773", "#e87500", "#f4a261", "#e9c46a", "#ffffff"];

function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }

  const particles: { x: number; y: number; vx: number; vy: number; size: number; color: string; rot: number; vr: number; circle: boolean }[] = [];
  for (const side of [0, 1]) {
    const originX = side === 0 ? canvas.width * 0.15 : canvas.width * 0.85;
    for (let i = 0; i < 70; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      const speed = 9 + Math.random() * 8;
      particles.push({
        x: originX,
        y: canvas.height * 0.75,
        vx: Math.cos(angle) * speed * (side === 0 ? 1 : -1) * (0.6 + Math.random() * 0.4),
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        circle: Math.random() > 0.5,
      });
    }
  }

  const start = performance.now();
  const DURATION = 2200;
  function frame(now: number) {
    const t = now - start;
    if (t > DURATION) { canvas.remove(); return; }
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    const fade = t > DURATION - 600 ? (DURATION - t) / 600 : 1;
    for (const p of particles) {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.globalAlpha = fade;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      if (p.circle) {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2.5, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx!.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ================= CHAT PANEL ================= */

type Msg = { from: "me" | "ai"; text: string };

// Mirrors server/projection.ts: this is the `context` the AI server expects.
export type Profile = { monthly_income: number; monthly_expenses: number; savings: number; debt: number };
export type Decision = { title: string; category: string; monthly_cost_change: number; one_time_cost: number; notes?: string };
export type ChatContext = { profile: Profile | null; decisions: Decision[] };

const API_URL = "/api/chat"; // dev: Vite proxies /api -> http://localhost:8787
const starters = ["Can I afford a $35k car?", "How fast can I pay off my car loan?", "What should I cut back on?"];

function Chat({ onClose, context, onSaveDecision }: { onClose: () => void; context: ChatContext; onSaveDecision: (d: Decision) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "ai", text: "Hi! Ask me about a big decision, like buying a car or a house, and I'll check it against your real numbers." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const appendToLast = (delta: string) =>
    setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, text: x.text + delta } : x)));

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    // Skip the greeting; the server adds its own system prompt.
    const messages = [...msgs.slice(1), { from: "me" as const, text }].map((m) => ({
      role: m.from === "me" ? "user" : "assistant",
      content: m.text,
    }));
    setMsgs((m) => [...m, { from: "me", text }, { from: "ai", text: "" }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, context }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // The server streams newline-delimited JSON events.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handle = (line: string) => {
        if (!line.trim()) return;
        const ev = JSON.parse(line) as { type: string; delta?: string; decision?: Decision };
        if (ev.type === "text" && ev.delta) appendToLast(ev.delta);
        else if (ev.type === "save_decision" && ev.decision) {
          onSaveDecision(ev.decision);
          appendToLast(`\n\n✓ Saved “${ev.decision.title}” to your decisions.\n\n`);
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer);
    } catch {
      appendToLast("Couldn't reach the assistant. Is the AI server running on port 8787?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside aria-label="Fin360+5 assistant" className="flex h-full flex-col bg-panel">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-utd text-utd-foreground"><Sparkles className="size-4" aria-hidden /></span>
          <div>
            <h2 className="font-semibold leading-tight">Fin360+5 intelligence</h2>
            <p className="text-sm text-muted-foreground">Plan what's next</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Hide assistant" className="grid size-11 place-items-center rounded-lg hover:bg-accent">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <ol aria-live="polite" className="flex-1 space-y-3 overflow-y-auto whitespace-pre-wrap px-5 py-5">
        {msgs.map((m, i) => (
          <li key={i} className={m.from === "me" ? "ml-8 rounded-xl bg-primary p-3 text-primary-foreground" : "mr-4 rounded-xl border bg-card p-3"}>
            <span className="sr-only">{m.from === "me" ? "You:" : "Assistant:"}</span>
            {m.text || "Thinking…"}
          </li>
        ))}
      </ol>

      <div className="space-y-2 px-5 pb-3">
        {starters.map((s) => (
          <button key={s} disabled={busy} onClick={() => void send(s)} className="block w-full rounded-lg border bg-card px-3 py-2.5 text-left text-sm hover:bg-accent disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex gap-2 border-t p-4">
        <label htmlFor="chat-input" className="sr-only">Ask about your finances</label>
        <input
          id="chat-input" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your money…"
          className="min-h-11 flex-1 rounded-lg border border-input bg-card px-3 placeholder:text-muted-foreground"
        />
        <button type="submit" disabled={busy} aria-label="Send message" className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <Send className="size-4" aria-hidden />
        </button>
      </form>
      <p className="px-4 pb-3 text-center text-xs text-muted-foreground">Not financial advice. For big moves, talk to an advisor.</p>
    </aside>
  );
}

/* ================= TAB SECTIONS ================= */

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-display text-2xl">{title}</h3>
        {sub && <p className="text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`font-semibold ${tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : ""}`}>{value}</dd>
    </div>
  );
}

const card = "rounded-xl border bg-card p-5";

function AccountsTab() {
  const max = Math.max(...projection), min = Math.min(...projection);
  const pts = projection.map((v, i) => `${(i / (projection.length - 1)) * 300},${90 - ((v - min) / (max - min)) * 80}`).join(" ");
  return (
    <div className="space-y-10">
      <Section title="Your accounts" sub="Checking and savings this month">
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((a) => (
            <article key={a.name} className={card}>
              <p className="text-sm text-muted-foreground">{a.type} · {a.institution}</p>
              <h4 className="font-semibold">{a.name}</h4>
              <p className="my-3 font-display text-3xl">{usd(a.balance)}</p>
              <dl className="grid grid-cols-3 gap-2">
                <Stat label="Deposits" value={usd(a.deposits)} />
                <Stat label="Withdrawals" value={usd(a.withdrawals)} />
                <Stat label="Cash flow" value={(a.cashFlow > 0 ? "+" : "") + usd(a.cashFlow)} tone={a.cashFlow >= 0 ? "up" : "down"} />
              </dl>
            </article>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Recurring payments">
          <ul className={`${card} divide-y py-2`}>
            {recurring.map((r) => (
              <li key={r.name} className="flex justify-between py-2.5">
                <span>{r.name} <span className="text-sm text-muted-foreground">· {r.category}</span></span>
                <span className="font-semibold">{usd(r.total)}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="A few things shifted">
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.title} className={`${card} flex gap-3`}>
                {a.tone === "warn"
                  ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="Warning" />
                  : <TrendingUp className="mt-0.5 size-5 shrink-0 text-success" aria-label="Good news" />}
                <div><p className="font-semibold">{a.title}</p><p className="text-muted-foreground">{a.body}</p></div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Your next three months" sub="If you keep spending like you do now">
        <div className={`${card} flex flex-wrap items-center gap-6`}>
          <svg viewBox="0 0 300 100" className="h-32 flex-1 min-w-60" role="img" aria-label={`Balance rising from ${usd((projection[0] ?? 0))} to ${usd((projection[projection.length - 1] ?? 0))}`}>
            <polyline points={pts} fill="none" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div>
            <p className="font-display text-3xl text-success">+{usd((projection[projection.length - 1] ?? 0) - (projection[0] ?? 0))}</p>
            <p className="text-muted-foreground">Projected by February</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function InvestmentsTab() {
  return (
    <div className="space-y-10">
      <Section title="Where it's invested">
        <div className="grid gap-4 md:grid-cols-3">
          {investments.map((i) => (
            <article key={i.name} className={card}>
              <p className="text-sm text-muted-foreground">{i.type} · {i.institution}</p>
              <h4 className="font-semibold">{i.name}</h4>
              <p className="my-3 font-display text-3xl">{usd(i.value)}</p>
              <dl className="grid grid-cols-2 gap-2">
                <Stat label="Contributed" value={usd(i.contributions)} />
                <Stat label="Gain" value={"+" + usd(i.gain)} tone="up" />
              </dl>
            </article>
          ))}
        </div>
      </Section>
      <Section title="One portfolio. The whole picture.">
        <div className={card}>
          <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
            {holdings.map((h, i) => <span key={h.ticker} style={{ width: `${h.pct}%`, opacity: 1 - i * 0.16 }} className="bg-primary" />)}
          </div>
          <table className="w-full text-left">
            <caption className="sr-only">Portfolio holdings</caption>
            <thead className="text-sm text-muted-foreground">
              <tr><th className="pb-2 font-medium">Holding</th><th className="pb-2 text-right font-medium">Shares</th><th className="pb-2 text-right font-medium">Portfolio</th></tr>
            </thead>
            <tbody className="divide-y">
              {holdings.map((h) => (
                <tr key={h.ticker}>
                  <td className="py-2.5"><span className="font-semibold">{h.ticker}</span> <span className="text-muted-foreground">{h.name}</span></td>
                  <td className="py-2.5 text-right">{h.shares}</td>
                  <td className="py-2.5 text-right font-semibold">{h.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <div className={`${card} bg-secondary`}>
        <p className="font-semibold">Growth-oriented, broadly diversified</p>
        <p className="text-muted-foreground">You're up $21,400 overall. Most of your money is in broad index funds, which keeps risk spread out.</p>
      </div>
    </div>
  );
}

function AssetsTab() {
  return (
    <Section title="What you own" sub="Estimated values, updated monthly">
      <div className="grid gap-4 md:grid-cols-2">
        {assets.map((a) => (
          <article key={a.name} className={card}>
            <p className="text-sm text-muted-foreground">{a.detail}</p>
            <h4 className="font-semibold">{a.name}</h4>
            <p className="mt-3 font-display text-3xl">{usd(a.value)}</p>
            <p className="text-muted-foreground">{a.change}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

function LoansTab() {
  const [paid, setPaid] = useState<Record<string, number>>({});
  const [justPaid, setJustPaid] = useState<string | null>(null);

  const pay = (name: string, amount: number) => {
    celebrate();
    setPaid((p) => ({ ...p, [name]: (p[name] ?? 0) + amount }));
    setJustPaid(name);
    window.setTimeout(() => setJustPaid((n) => (n === name ? null : n)), 4000);
  };

  return (
    <Section title="What you owe" sub="Every loan, and when it's done">
      <div className="grid gap-4 md:grid-cols-2">
        {loans.map((l) => {
          const owed = l.owed - (paid[l.name] ?? 0);
          const pct = Math.min(100, Math.round(((l.principal - owed) / l.principal) * 100));
          return (
            <article key={l.name} className={card}>
              <p className="text-sm text-muted-foreground">{l.type}</p>
              <h4 className="font-semibold">{l.name}</h4>
              <p className="my-3 font-display text-3xl">{usd(owed)} <span className="font-sans text-base text-muted-foreground">owed</span></p>
              <dl className="mb-4 grid grid-cols-2 gap-3">
                <Stat label="Borrowed" value={usd(l.principal)} />
                <Stat label="Principal left" value={usd(l.remaining)} />
                <Stat label="Interest rate" value={l.rate} />
                <Stat label="Expected payoff" value={l.payoff} />
              </dl>
              <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${l.name} paid off`} className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{pct}% paid off</p>
              <button
                onClick={() => pay(l.name, l.monthly)}
                className="mt-4 min-h-11 w-full rounded-lg bg-primary font-semibold text-primary-foreground hover:opacity-90"
              >
                Pay {usd(l.monthly)} now
              </button>
              <p aria-live="polite" className="mt-2 text-sm font-semibold text-success">
                {justPaid === l.name ? "Payment received on time — nice work! 🎉" : ""}
              </p>
            </article>
          );
        })}
      </div>
      <div className={`${card} flex gap-3 bg-secondary`}>
        <PartyPopper className="size-5 shrink-0 text-success" aria-hidden />
        <p><span className="font-semibold">Almost there!</span> Paying an extra $250/month would clear your auto loan by December.</p>
      </div>
    </Section>
  );
}


/* ================= MAIN DASHBOARD ================= */
const tabs = [
  { id: "accounts", label: "Accounts", el: <AccountsTab /> },
  { id: "investments", label: "Investments", el: <InvestmentsTab /> },
  { id: "assets", label: "Assets", el: <AssetsTab /> },
  { id: "loans", label: "Loans", el: <LoansTab /> },
];

export default function Dashboard() {
  const [tab, setTab] = useState("accounts");
  const [chatOpen, setChatOpen] = useState(true);
  const [decisions, setDecisions] = useState<Decision[]>(() => {
    try { return JSON.parse(localStorage.getItem("fin360-decisions") ?? "[]"); } catch { return []; }
  });
  const saveDecision = (d: Decision) =>
    setDecisions((prev) => {
      const next = [...prev, d];
      try { localStorage.setItem("fin360-decisions", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  return (
    <div className="flex h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:p-3">Skip to content</a>
      <header className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2 text-lg font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-utd text-utd-foreground"><Leaf className="size-4" aria-hidden /></span>
            Fin360+5
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Notifications" className="grid size-11 place-items-center rounded-lg hover:bg-accent"><Bell className="size-5" aria-hidden /></button>
          <span className="grid size-9 place-items-center rounded-full bg-accent font-semibold text-accent-foreground" aria-label="Signed in as Rashmi">R</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main id="main" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="font-display text-4xl">A clear view of your money.</h1>
                <p className="text-muted-foreground">Everything you have and owe, in one place.</p>
              </div>
              <p className="text-sm text-muted-foreground">Updated Nov 7, 2026</p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-primary p-5 text-primary-foreground">
                <dt className="opacity-90">Net worth</dt>
                <dd className="font-display text-4xl">{usd(totals.netWorth)}</dd>
                <dd className="text-sm opacity-90">Up $8,400 since last month</dd>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <dt className="text-muted-foreground">Total assets</dt>
                <dd className="font-display text-4xl">{usd(totals.assets)}</dd>
                <dd className="text-sm text-muted-foreground">Cash, investments, property</dd>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <dt className="text-muted-foreground">Total liabilities</dt>
                <dd className="font-display text-4xl">{usd(totals.liabilities)}</dd>
                <dd className="text-sm text-muted-foreground">Mortgage and auto loan</dd>
              </div>
            </dl>

            <div role="tablist" aria-label="Finance sections" className="flex gap-1 overflow-x-auto border-b">
              {tabs.map((t) => (
                <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px min-h-11 border-b-2 px-4 font-medium ${tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tabs.map((t) => (
              <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={tab !== t.id}>
                {tab === t.id && t.el}
              </div>
            ))}
          </div>
        </main>

        {chatOpen ? (
          <div className="hidden w-96 shrink-0 border-l md:block"><Chat onClose={() => setChatOpen(false)} context={{ profile, decisions }} onSaveDecision={saveDecision} /></div>
        ) : (
          <button onClick={() => setChatOpen(true)} className="fixed bottom-6 right-6 flex min-h-12 items-center gap-2 rounded-full bg-utd px-5 font-semibold text-utd-foreground shadow-lg">
            <MessageCircle className="size-5" aria-hidden /> Ask Fin360+5
          </button>
        )}
      </div>
    </div>
  );
}