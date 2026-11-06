import { Fragment, type ReactNode } from "react";

/**
 * Puts nodes into a copy template's `{name}` slots — a number box into
 * "Skip button appears after {n} seconds", a bold date into "Starts on
 * {start}…" — so each language keeps its own word order around the box or
 * the value (lib/i18n/ads/wizard.ts). A slot with no value is left as the
 * text it is, so a typo in the copy shows up instead of vanishing.
 */
export function fill(template: string, values: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{key !== undefined && key in values ? values[key] : part}</Fragment>;
  });
}

/** `fill` with every slot in bold — the values a summary sentence is about. */
export function fillBold(template: string, values: Record<string, ReactNode>): ReactNode {
  return fill(
    template,
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        <strong key={key} className="font-semibold text-foreground">
          {value}
        </strong>,
      ]),
    ),
  );
}
