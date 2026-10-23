import { createContext, useContext, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { initialDraft } from "./model";
import type { SimulationDraft } from "./model";

interface DraftContextValue {
  draft: SimulationDraft;
  setDraft: Dispatch<SetStateAction<SimulationDraft>>;
  resetDraft: () => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

export function SimulationDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SimulationDraft>({ ...initialDraft });
  return (
    <DraftContext.Provider
      value={{
        draft,
        setDraft,
        resetDraft: () => setDraft({ ...initialDraft }),
      }}
    >
      {children}
    </DraftContext.Provider>
  );
}

export function useSimulationDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error("SimulationDraftProviderが必要です。");
  return context;
}
