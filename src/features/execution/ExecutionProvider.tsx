import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useSimulationDraft } from "../simulation/SimulationDraftContext";
import { draftFromInput, draftToInput } from "../simulation/model";
import type { SimulationDraft } from "../simulation/model";
import type { ExecutionInput, WorkerPort } from "./protocol";
import { ExecutionClient } from "./client";
import type { ExecutionState } from "./client";
import { inputKey } from "./input";

const workerFactory = (): WorkerPort => {
  if (typeof Worker === "undefined") throw new Error("このブラウザではWeb Workerを利用できません。対応ブラウザで開き直してください。");
  return new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "eco-mirror-calculation" }) as unknown as WorkerPort;
};
interface Value {
  state: ExecutionState;
  stale: boolean;
  start: () => void;
  rerun: () => void;
  edit: (patch: Partial<SimulationDraft>) => void;
  cancel: () => void;
  selectTrial: (index: number) => void;
  prepareExport: () => void;
}
const Context = createContext<Value | null>(null);
export function ExecutionProvider({ children, factory = workerFactory }: { children: ReactNode; factory?: () => WorkerPort }) {
  const { draft, setDraft } = useSimulationDraft();
  const client = useMemo(() => new ExecutionClient(factory), [factory]);
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  let current: ExecutionInput | null = null;
  try { current = draftToInput(draft); } catch { /* Invalid editable input remains invalid, never coerced. */ }
  const currentKey = current ? inputKey(current) : null;
  const executedKey = state.input ? inputKey(state.input) : null;
  const stale = !!state.payload && currentKey !== executedKey;
  useEffect(() => () => client.dispose(), [client]);
  useEffect(() => {
    if (["loading", "running"].includes(state.status) && currentKey !== executedKey) client.cancel("条件を変更したため実行を中止しました。新しい条件で実行してください。");
  }, [client, currentKey, executedKey, state.status]);
  const edit = (patch: Partial<SimulationDraft>) => {
    if (["loading", "running"].includes(client.getSnapshot().status) || client.getSnapshot().exportStatus === "preparing") client.cancel("条件を変更したため処理を中止しました。新しい条件で実行してください。");
    setDraft(previous => ({ ...previous, ...patch }));
  };
  return <Context.Provider value={{ state, stale, edit,
    start: () => client.start(draftToInput(draft)),
    rerun: () => { const input = client.getSnapshot().input; if (input) { setDraft(draftFromInput(input)); client.start(input); } },
    cancel: () => client.cancel(), selectTrial: index => client.selectTrial(index), prepareExport: () => client.prepareExport(),
  }}><div className="sr-only" role="status" aria-label="実行状況の通知" aria-live="polite" aria-atomic="true">{state.status === "idle" ? "" : `計算の状態：${state.message}`}</div>{children}</Context.Provider>;
}
export function useExecution() { const value = useContext(Context); if (!value) throw new Error("ExecutionProviderが必要です。"); return value; }
