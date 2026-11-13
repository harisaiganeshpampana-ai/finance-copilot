// Validation for the Settings form. Runs on the server (see the save action);
// never trust what the browser sends.

export const NOTIFICATION_KEYS = ["weeklySummary", "largeTransactionAlerts", "copilotTips"] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

export type SettingsInput = {
  fullName: string;
  email: string;
  darkMode: boolean;
  notifications: Record<NotificationKey, boolean>;
};

export type SettingsField = "fullName" | "email" | "darkMode" | "notifications" | "form";

export type ValidationResult =
  | { ok: true; data: SettingsInput }
  | { ok: false; errors: Partial<Record<SettingsField, string>> };

export const FULL_NAME_MAX = 100;
export const EMAIL_MAX = 254;
// Practical email check: something@something.tld, no spaces.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Disallow control characters (e.g. newlines, null bytes) in names.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function validateSettings(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, errors: { form: "Invalid request." } };
  const errors: Partial<Record<SettingsField, string>> = {};

  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  if (!fullName) errors.fullName = "Enter your full name.";
  else if (fullName.length > FULL_NAME_MAX) errors.fullName = `Name must be ${FULL_NAME_MAX} characters or fewer.`;
  else if (CONTROL_CHARS.test(fullName)) errors.fullName = "Name contains invalid characters.";

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email) errors.email = "Enter your email address.";
  else if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";

  if (typeof input.darkMode !== "boolean") errors.darkMode = "Invalid value.";

  const n = input.notifications;
  const notificationsValid =
    isRecord(n) &&
    Object.keys(n).length === NOTIFICATION_KEYS.length &&
    NOTIFICATION_KEYS.every((k) => typeof n[k] === "boolean");
  if (!notificationsValid) errors.notifications = "Invalid notification settings.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      fullName,
      email,
      darkMode: input.darkMode as boolean,
      notifications: n as Record<NotificationKey, boolean>,
    },
  };
}
