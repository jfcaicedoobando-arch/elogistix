export function topChartHeightClass(rowCount: number): string {
  if (rowCount === 1) return "h-24";
  if (rowCount <= 4) return "h-56";
  if (rowCount <= 6) return "h-64";
  if (rowCount <= 8) return "h-72";
  if (rowCount === 9) return "h-80";
  return "h-[350px]";
}
