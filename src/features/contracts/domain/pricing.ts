export function minFinalPrice(unitPrice: number): number {
  return Math.ceil((unitPrice * 95) / 100);
}
