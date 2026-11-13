"use client";

import { useState } from "react";

import { parseRiyals, toRiyalText } from "@/shared/lib/money";

function toText(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? "" : toRiyalText(value);
}

/**
 * Keeps the riyal text the user typed. A new `value` from outside (form reset, edit defaults)
 * replaces the text only when it differs from what the text already means.
 */
export function useMoneyInput(value: number | undefined, onChange: (halalas: number) => void) {
  const [text, setText] = useState(() => toText(value));
  const [prevValue, setPrevValue] = useState(value);

  if (!Object.is(value, prevValue)) {
    setPrevValue(value);
    if (!Object.is(parseRiyals(text) ?? NaN, value ?? NaN)) setText(toText(value));
  }

  return {
    text,
    onTextChange: (next: string) => {
      setText(next);
      onChange(parseRiyals(next) ?? NaN);
    },
  };
}
