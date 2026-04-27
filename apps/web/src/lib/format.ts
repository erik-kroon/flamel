export function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSigned(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPrice(value)}`;
}

export function formatQuantity(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

export function formatBasisPoints(value: number) {
  return `${value.toFixed(1)} bp`;
}

export function formatMoney(value: number) {
  const prefix = value < 0 ? "-" : "";
  return `${prefix}$${formatPrice(Math.abs(value))}`;
}

export function formatSignedMoney(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}$${formatPrice(Math.abs(value))}`;
}
