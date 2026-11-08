import { useState } from "react";
import { streamChat, type Msg } from "./lib/chat";
import { useFinanceContext } from "./lib/useFinanceContext";

const FIELDS = [
  { key: "monthly_income", label: "Monthly income" },
  { key: "monthly_expenses", label: "Monthly expenses" },
  { key: "savings", label: "Savings" },
  { key: "debt", label: "Debt" },
] as const;

export default function Chat() {
  const { profile, decisions, setProfile, addDecision } = useFinanceContext();
  const [draft, setDraft] = useState(
    profile ?? { monthly_income: 0, monthly_expenses: 0, savings: 0, debt: 0 }
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!input.trim() || busy) return;
    setBusy(true);
    const next: Msg[] = [...messages, { role: "user", content: input }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    try {
      await streamChat(next, { profile, decisions }, {
        onText: (t) =>
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = {
              role: "assistant",
              content: copy[copy.length - 1].content + t,
            };
            return copy;
          }),
        onSaveDecision: addDecision,
      });
    } catch {
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "[Couldn't reach the AI server.]" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <aside>
        <h3>Your profile</h3>
        {FIELDS.map((f) => (
          <label key={f.key} style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
            {f.label}
            <input
              type="number"
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
              style={{ display: "block", width: "100%", padding: 6 }}
            />
          </label>
        ))}
        <button onClick={() => setProfile(draft)}>Save profile</button>

        <h3 style={{ marginTop: 24 }}>Saved decisions</h3>
        {decisions.length === 0 && <p style={{ fontSize: 14, opacity: 0.6 }}>None yet.</p>}
        <ul style={{ paddingLeft: 18, fontSize: 14 }}>
        {decisions.map((d, i) => (
            <li key={i}>
            {d.title}: ${d.monthly_cost_change}/mo, ${d.one_time_cost} upfront
            </li>
        ))}
</ul>
      </aside>

      <section style={{ display: "flex", flexDirection: "column", height: "80vh" }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <p style={{ opacity: 0.6 }}>Try: "Can I afford a $30,000 car with $5,000 down and $450/month?"</p>
          )}
          {messages.map((m, i) => (
            <p
              key={i}
              style={{
                whiteSpace: "pre-wrap",
                margin: 0,
                padding: 12,
                borderRadius: 8,
                background: m.role === "user" ? "#dbeafe" : "#f3f4f6",
                color: "#111",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
              }}
            >
              {m.content || (busy ? "…" : "")}
            </p>
          ))}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about a financial decision…"
          style={{ marginTop: 12, padding: 12 }}
        />
        <small style={{ opacity: 0.6, marginTop: 6 }}>Not financial advice. Projections are rough estimates.</small>
      </section>
    </div>
  );
}