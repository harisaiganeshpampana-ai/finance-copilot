// Server-side validation for sign-up and log-in. Never trust what the browser sends.

export const NAME_MAX = 100;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt only uses the first 72 bytes

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type SignupInput = { name: string; email: string; password: string };
export type SignupField = "name" | "email" | "password" | "form";
export type SignupValidation =
  | { ok: true; data: SignupInput }
  | { ok: false; errors: Partial<Record<SignupField, string>> };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= EMAIL_MAX && EMAIL_PATTERN.test(email);
}

export function validateSignup(input: unknown): SignupValidation {
  if (!isRecord(input)) return { ok: false, errors: { form: "Invalid request." } };
  const errors: Partial<Record<SignupField, string>> = {};

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) errors.name = "Enter your name.";
  else if (name.length > NAME_MAX) errors.name = `Name must be ${NAME_MAX} characters or fewer.`;
  else if (CONTROL_CHARS.test(name)) errors.name = "Name contains invalid characters.";

  const email = normalizeEmail(input.email);
  if (!email) errors.email = "Enter your email address.";
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address.";

  const password = typeof input.password === "string" ? input.password : "";
  if (password.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (new TextEncoder().encode(password).length > PASSWORD_MAX) errors.password = "Password is too long.";
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.password = "Include at least one letter and one number.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { name, email, password } };
}

/** Basic shape check for log-in credentials (detailed checks happen against the database). */
export function parseLoginCredentials(input: unknown): { email: string; password: string } | null {
  if (!isRecord(input)) return null;
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  if (!isValidEmail(email) || password.length === 0 || password.length > 1024) return null;
  return { email, password };
}
