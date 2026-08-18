export function roundBurdenAmount(value) {
    // Centralized intentionally so the future rounding rule can be changed in one place.
    return Math.round(Math.max(0, value));
}
export function calculateBurdenAmounts(monthlyAmount) {
    const base = Number.isFinite(monthlyAmount) ? Math.max(0, monthlyAmount) : 0;
    return {
        burden1: roundBurdenAmount(base * 0.1),
        burden2: roundBurdenAmount(base * 0.2),
        burden3: roundBurdenAmount(base * 0.3)
    };
}
export function formatYen(value) {
    return `${Math.max(0, Math.round(value || 0)).toLocaleString('ja-JP')}円`;
}
//# sourceMappingURL=pricing.js.map