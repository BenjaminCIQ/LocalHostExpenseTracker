import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency = "EUR",
  options?: { maximumFractionDigits?: number }
): string {
  const frac = options?.maximumFractionDigits;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    ...(frac !== undefined && {
      maximumFractionDigits: frac,
      minimumFractionDigits: frac,
    }),
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
