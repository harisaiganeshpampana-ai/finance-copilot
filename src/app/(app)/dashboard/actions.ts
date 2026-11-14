"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { seedSampleData } from "@/lib/server/transactions";

export type GenerateSampleDataResult = { ok: true; created: boolean } | { ok: false; error: string };

/**
 * Loads the 10 sample transactions for the logged-in user. Takes no input from the browser:
 * the user comes from the server-side session, and it only runs if they have no data yet.
 */
export async function generateSampleData(): Promise<GenerateSampleDataResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in again." };
  try {
    const { created } = await seedSampleData(user.id);
    revalidatePath("/dashboard");
    return { ok: true, created };
  } catch (err) {
    console.error("[data] Generate sample data failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Couldn't create sample data. Please try again." };
  }
}
