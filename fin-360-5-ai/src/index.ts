import express from "express";
import { Ollama, Message } from "ollama";
import { Context, monthlyNet } from "./projection.js";
import { tools, runTool } from "./tools.js";

const ollama = new Ollama({ host: "http://127.0.0.1:11434" });
const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:4b";
const PORT = 8787;

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function buildSystem(ctx: Context) {
  const p = ctx.profile;
  const profileText = p
    ? `Monthly income: ${usd(p.monthly_income)}
Monthly expenses: ${usd(p.monthly_expenses)}
Savings: ${usd(p.savings)}
Debt: ${usd(p.debt)}
Current monthly cash flow after saved decisions: ${usd(monthlyNet(ctx)!)}`
    : "No profile saved yet. Ask the user to fill in their profile before giving projections.";

  const decisionsText = ctx.decisions.length
    ? ctx.decisions
        .map((d) => `- ${d.title} (${d.category}): ${usd(d.monthly_cost_change)}/month, ${usd(d.one_time_cost)} one-time${d.notes ? `. ${d.notes}` : ""}`)
        .join("\n")
    : "None yet.";

  return `You are a financial planning assistant inside a budgeting app. Be concise and friendly.

USER PROFILE:
${profileText}

SAVED DECISIONS:
${decisionsText}

RULES:
- For ANY projection, forecast, or affordability number, call project_finances. Never do math yourself.
- To evaluate a purchase, call project_finances with the hypothetical costs, then explain the result in plain language.
- Only call save_decision after the user clearly confirms they are making the decision.
- State your assumptions. You are not a licensed financial advisor.`;
}

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const { messages, context } = req.body as { messages: Message[]; context: Context };
  const convo: Message[] = [{ role: "system", content: buildSystem(context) }, ...messages];

  res.setHeader("Content-Type", "application/x-ndjson");
  const emit = (event: object) => res.write(JSON.stringify(event) + "\n");

  try {
    for (let round = 0; round < 4; round++) {
      const stream = await ollama.chat({ model: MODEL, messages: convo, tools, stream: true, think: false });
      let content = "";
      const toolCalls: NonNullable<Message["tool_calls"]> = [];

      for await (const chunk of stream) {
        if (chunk.message.content) {
          content += chunk.message.content;
          emit({ type: "text", delta: chunk.message.content });
        }
        if (chunk.message.tool_calls) toolCalls.push(...chunk.message.tool_calls);
      }

      convo.push({ role: "assistant", content, tool_calls: toolCalls });
      if (toolCalls.length === 0) break;

      for (const call of toolCalls) {
        const result = runTool(call.function.name, call.function.arguments, context, emit);
        convo.push({ role: "tool", content: JSON.stringify(result), tool_name: call.function.name });
      }
    }
  } catch {
    emit({ type: "text", delta: "\n\n[Couldn't reach the model. Is Ollama running, and have you pulled qwen3:4b?]" });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => console.log(`AI server on http://localhost:${PORT}`));