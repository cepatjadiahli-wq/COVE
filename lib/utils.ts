import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number or string as Indonesian Rupiah (IDR)
 * Example: 3200000000 -> "Rp 3.200.000.000"
 */
export function formatIDR(amount: number | string | null | undefined, options?: { showZero?: boolean; compact?: boolean }): string {
  if (amount === null || amount === undefined || amount === "") {
    return options?.showZero ? "Rp 0" : "-";
  }

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "-";
  if (num === 0 && !options?.showZero) return "Rp 0";

  if (options?.compact) {
    if (Math.abs(num) >= 1_000_000_000_000) {
      return `Rp ${(num / 1_000_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} T`;
    }
    if (Math.abs(num) >= 1_000_000_000) {
      return `Rp ${(num / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
    }
    if (Math.abs(num) >= 1_000_000) {
      return `Rp ${(num / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} Jt`;
    }
  }

  return "Rp " + new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Parses an IDR currency string or raw number input into a clean numeric string or number
 */
export function parseIDR(input: string | number): number {
  if (typeof input === "number") return input;
  if (!input) return 0;
  // Remove "Rp", dots, spaces, etc., except decimal commas if present
  const cleaned = input
    .replace(/Rp\s?/gi, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Generates human readable ID with prefix and zero-padded sequence
 */
export function generateHumanId(prefix: string, seq: number, padLength = 4): string {
  return `${prefix}-${String(seq).padStart(padLength, "0")}`;
}

/**
 * Calculates calendar day differences between two dates in Asia/Jakarta timezone
 */
export function getDaysDiff(fromDate: Date | string, toDate: Date | string = new Date()): number {
  const d1 = new Date(fromDate);
  const d2 = new Date(toDate);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}
