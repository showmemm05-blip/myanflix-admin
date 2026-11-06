import type { Dispatch, SetStateAction } from "react";
import type { AdFormState, AdIssueCode } from "@/components/ads/adForm";
import type { Ad } from "@/types/ad";

/** What every step of the wizard gets from AdWizard. */
export interface StepProps {
  state: AdFormState;
  setState: Dispatch<SetStateAction<AdFormState>>;
  /** Sets one field. */
  set: <K extends keyof AdFormState>(key: K, value: AdFormState[K]) => void;
  /** The stored row (editing, or created by an earlier Save that then failed), or null. */
  existing: Ad | null;
  /** A save is running: every control waits for it. */
  disabled: boolean;
  /**
   * The problems to mark red on this step's fields: when creating, only
   * after Next or Save was refused on this step; when editing, always.
   */
  marked: ReadonlySet<AdIssueCode>;
}

/** Whether any of `codes` is marked — one field can break several rules. */
export function markedAny(marked: ReadonlySet<AdIssueCode>, ...codes: AdIssueCode[]): boolean {
  return codes.some((code) => marked.has(code));
}
