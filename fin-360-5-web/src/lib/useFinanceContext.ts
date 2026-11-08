import { useCallback, useState } from "react";
import type { ChatContext, SavedDecision } from "./chat";

const KEY = "fin360-mock-finance";
const empty: ChatContext = { profile: null, decisions: [] };

function load(): ChatContext {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "") as ChatContext;
  } catch {
    return empty;
  }
}

export function useFinanceContext() {
  const [ctx, setCtx] = useState<ChatContext>(load);

  const persist = (next: ChatContext) => {
    setCtx(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };

  const setProfile = useCallback(
    (profile: NonNullable<ChatContext["profile"]>) => persist({ ...ctx, profile }),
    [ctx]
  );

  const addDecision = useCallback(
    (d: SavedDecision) => persist({ ...ctx, decisions: [...ctx.decisions, d] }),
    [ctx]
  );

  return { profile: ctx.profile, decisions: ctx.decisions, setProfile, addDecision };
}