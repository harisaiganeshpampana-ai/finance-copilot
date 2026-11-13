"use server";

import { validateSettings, type ValidationResult } from "@/lib/validation/settings";

/**
 * Server action for the Settings form. Validates on the server.
 * Nothing is stored yet (no database); once accounts exist, persist `result.data` here.
 */
export async function saveSettings(input: unknown): Promise<ValidationResult> {
  const result = validateSettings(input);
  return result;
}
