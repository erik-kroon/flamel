export function ageMs(timestamp: number, now = Date.now()) {
  return Math.max(0, now - timestamp);
}

export function formatAge(timestamp: number, now = Date.now()) {
  const age = ageMs(timestamp, now);
  if (age < 1000) {
    return `${Math.round(age)}ms`;
  }

  return `${(age / 1000).toFixed(1)}s`;
}

export function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(timestamp);
}
