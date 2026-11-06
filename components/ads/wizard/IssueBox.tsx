"use client";

import { AlertCircle } from "lucide-react";

interface IssueBoxProps {
  /** "Please fix this before going on:" */
  title: string;
  messages: readonly string[];
}

/**
 * The red box over a step that holds a problem (the `WizProblem` board):
 * what is wrong, in whole sentences, above the step's own fields — which
 * are marked red too. An alert, so a screen reader reads it out the moment
 * Next or Save is refused.
 */
export function IssueBox({ title, messages }: IssueBoxProps) {
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1 text-sm leading-relaxed">
        <b className="font-semibold text-destructive">{title}</b>
        <ul className="flex flex-col gap-0.5 text-foreground/90">
          {messages.map((message) => (
            <li key={message}>• {message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
