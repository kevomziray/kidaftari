import { timingSafeEqual } from "crypto";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeTanzanianPhone(value: string) {
  const digits = value.trim().replace(/[\s()-]/g, "");
  if (/^0[67]\d{8}$/.test(digits)) return `+255${digits.slice(1)}`;
  if (/^255[67]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^\+255[67]\d{8}$/.test(digits)) return digits;
  throw new Error("Enter a valid Tanzanian mobile number, for example 0712 345 678.");
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}
