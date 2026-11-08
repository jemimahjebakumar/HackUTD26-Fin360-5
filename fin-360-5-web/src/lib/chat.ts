export type Msg = { role: "user" | "assistant"; content: string };

export type ChatContext = {
  profile: {
    monthly_income: number;
    monthly_expenses: number;
    savings: number;
    debt: number;
  } | null;
  decisions: {
    title: string;
    category: string;
    monthly_cost_change: number;
    one_time_cost: number;
    notes?: string;
  }[];
};

export type SavedDecision = ChatContext["decisions"][number];

export async function streamChat(
  messages: Msg[],
  context: ChatContext,
  handlers: { onText: (t: string) => void; onSaveDecision: (d: SavedDecision) => void }
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!; // keep any partial line for the next read
    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line);
      if (ev.type === "text") handlers.onText(ev.delta);
      if (ev.type === "save_decision") handlers.onSaveDecision(ev.decision);
    }
  }
}