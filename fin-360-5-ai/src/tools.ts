import { z } from "zod";
import type { Tool } from "ollama";
import { Context, projectFinances } from "./projection.js";

export const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "project_finances",
      description:
        "Project the user's savings N months ahead, optionally including a hypothetical purchase. Use this for every number or prediction.",
      parameters: {
        type: "object",
        required: ["months"],
        properties: {
          months: { type: "number", description: "How many months ahead" },
          hypothetical_monthly_cost: { type: "number", description: "Extra monthly cost, e.g. a car payment" },
          hypothetical_one_time_cost: { type: "number", description: "Upfront cost, e.g. a down payment" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_decision",
      description: "Save a financial decision. Only call after the user explicitly confirms they are going through with it.",
      parameters: {
        type: "object",
        required: ["title", "category"],
        properties: {
          title: { type: "string" },
          category: { type: "string", description: "car, house, debt, investment, or other" },
          monthly_cost_change: { type: "number" },
          one_time_cost: { type: "number" },
          notes: { type: "string" },
        },
      },
    },
  },
];

const ProjectArgs = z.object({
  months: z.coerce.number().int().min(1).max(600),
  hypothetical_monthly_cost: z.coerce.number().optional(),
  hypothetical_one_time_cost: z.coerce.number().optional(),
});

export const SaveArgs = z.object({
  title: z.string().min(1),
  category: z.string().default("other"),
  monthly_cost_change: z.coerce.number().default(0),
  one_time_cost: z.coerce.number().default(0),
  notes: z.string().default(""),
});

export function runTool(
  name: string,
  args: unknown,
  ctx: Context,
  emit: (event: object) => void
) {
  try {
    switch (name) {
      case "project_finances": {
        const a = ProjectArgs.parse(args);
        const hasExtra = a.hypothetical_monthly_cost || a.hypothetical_one_time_cost;
        return projectFinances(
          ctx,
          a.months,
          hasExtra
            ? {
                monthly_cost_change: a.hypothetical_monthly_cost ?? 0,
                one_time_cost: a.hypothetical_one_time_cost ?? 0,
              }
            : undefined
        );
      }
      case "save_decision": {
        const d = SaveArgs.parse(args);
        emit({ type: "save_decision", decision: d }); // the browser writes it to the store
        return { ok: true };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: `Invalid arguments: ${e instanceof Error ? e.message : String(e)}` };
  }
}