"use client";

import { Input } from "@/shared/components/ui/input";
import type { MoneyInputProps } from "./types";
import { useMoneyInput } from "./use-money-input";

/** Riyal text in, integer halalas out (NaN when the text is not a valid amount). */
export function MoneyInput({ value, onChange, ...props }: MoneyInputProps) {
  const { text, onTextChange } = useMoneyInput(value, onChange);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      dir="ltr"
      autoComplete="off"
      value={text}
      onChange={(event) => onTextChange(event.target.value)}
    />
  );
}
