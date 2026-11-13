export function parseRiyals(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const [whole = "0", fraction = ""] = trimmed.split(".");
  const halalas = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return halalas <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(halalas) : null;
}

// Latin digits, so prices match the other numbers in tables and inputs.
const riyalFormatter = new Intl.NumberFormat("ar-SA-u-nu-latn", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function splitHalalas(halalas: number): { whole: bigint; fraction: string } {
  const amount = BigInt(halalas);
  return { whole: amount / 100n, fraction: (amount % 100n).toString().padStart(2, "0") };
}

/** Formats with an exact decimal string, so no float division touches the amount. */
export function formatRiyals(halalas: number): string {
  const { whole, fraction } = splitHalalas(halalas);
  return riyalFormatter.format(`${whole}.${fraction}` as Intl.StringNumericLiteral);
}

export function toRiyalText(halalas: number): string {
  const { whole, fraction } = splitHalalas(halalas);
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}
