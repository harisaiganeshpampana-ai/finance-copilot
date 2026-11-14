"use server";

import { registerUser } from "@/lib/auth/credentials";
import type { SignupField } from "@/lib/auth/validation";

export type SignUpResult = { ok: true } | { ok: false; errors: Partial<Record<SignupField, string>> };

/**
 * Creates an account. Runs on the server: validates input, rejects duplicate emails,
 * hashes the password with bcrypt and saves the user to MongoDB.
 * Never returns the password or its hash.
 */
export async function signUp(input: unknown): Promise<SignUpResult> {
  const result = await registerUser(input);
  return result.ok ? { ok: true } : { ok: false, errors: result.errors };
}
