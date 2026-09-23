export function topChartHeight(rowCount: number): number {
  if (rowCount <= 0) return 220;
  return Math.min(350, Math.max(220, 72 + rowCount * 32));
}