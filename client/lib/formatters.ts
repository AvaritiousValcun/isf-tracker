export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "KES"
): string {
  const numericAmount =
    typeof amount === "string" ? Number(amount) : amount ?? 0;

  if (!Number.isFinite(numericAmount)) {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(0);
  }

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

export function formatDate(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatNumber(
  value: number | string | null | undefined
): string {
  const numericValue =
    typeof value === "string" ? Number(value) : value ?? 0;

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-KE").format(numericValue);
}