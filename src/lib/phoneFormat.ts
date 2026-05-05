/**
 * Formats a phone input progressively to +55 (11) 91234-5678
 */
export function formatPhoneInput(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");

  if (digits.length === 0) return "";

  let result = "+";

  if (digits.length <= 2) {
    result += digits;
  } else if (digits.length <= 4) {
    result += `${digits.slice(0, 2)} (${digits.slice(2)}`;
  } else if (digits.length <= 6) {
    result += `${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
  } else if (digits.length <= 11) {
    result += `${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  } else {
    result += `${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }

  return result;
}

/**
 * Strips phone to only digits (removes formatting)
 */
export function stripPhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Phone placeholder used across the app
 */
export const PHONE_PLACEHOLDER = "+55 (11) 91234-5678";
