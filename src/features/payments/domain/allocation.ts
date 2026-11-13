/** One schedule line as allocation sees it. Money is integer halalas. */
export type AllocationLine = {
  id: string;
  seq: number;
  amount: number;
  paidAmount: number;
};

export type AllocationItem = {
  installmentId: string;
  seq: number;
  applied: number;
};

/** What is still owed on these lines. */
export function openAmount(lines: readonly AllocationLine[]): number {
  return lines.reduce((sum, line) => sum + (line.amount - line.paidAmount), 0);
}

/**
 * Applies a payment to the lowest line numbers first (the down payment, seq 0, first),
 * skipping full lines. The applied amounts add up to `amount` exactly.
 * The service checks the amount against the remaining total first; this throws if that was skipped.
 */
export function allocatePayment(
  lines: readonly AllocationLine[],
  amount: number,
): AllocationItem[] {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new RangeError("Payment amount must be a positive whole number of halalas");
  }
  if (amount > openAmount(lines)) {
    throw new RangeError("Payment amount is above the open amount");
  }

  const items: AllocationItem[] = [];
  let left = amount;
  for (const line of [...lines].sort((a, b) => a.seq - b.seq)) {
    if (left === 0) break;
    const open = line.amount - line.paidAmount;
    if (open <= 0) continue;
    const applied = Math.min(open, left);
    items.push({ installmentId: line.id, seq: line.seq, applied });
    left -= applied;
  }
  return items;
}
