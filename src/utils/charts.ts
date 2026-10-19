// Shared chart axis helpers

// A round axis step giving about four gridlines up to `max`
export function getTickStep(max: number) {
  const rough = Math.max(max, 1) / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const multiple = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough)!
  return Math.max(1, multiple * magnitude)
}

// Axis labels: 1500 -> 1.5K, 2000000 -> 2M
export function formatCompact(value: number) {
  if (value >= 1_000_000) return `${value / 1_000_000}M`
  if (value >= 1_000) return `${value / 1_000}K`
  return String(value)
}
