export function presenceIntervalSeconds(value: string | undefined): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 10 ? seconds : 45;
}
