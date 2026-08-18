export interface BurdenAmounts { burden1: number; burden2: number; burden3: number; }

export function roundBurdenAmount(value: number): number {
  // Centralized intentionally so the future rounding rule can be changed in one place.
  return Math.round(Math.max(0, value));
}

export function calculateBurdenAmounts(monthlyAmount: number): BurdenAmounts {
  const base = Number.isFinite(monthlyAmount) ? Math.max(0, monthlyAmount) : 0;
  return {
    burden1: roundBurdenAmount(base * 0.1),
    burden2: roundBurdenAmount(base * 0.2),
    burden3: roundBurdenAmount(base * 0.3)
  };
}

export function formatYen(value: number): string {
  return `${Math.max(0, Math.round(value || 0)).toLocaleString('ja-JP')}円`;
}
