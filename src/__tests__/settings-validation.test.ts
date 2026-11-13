import { describe, expect, it } from "vitest";
import { saveSettings } from "@/app/(app)/settings/actions";
import { validateSettings } from "@/lib/validation/settings";

const valid = {
  fullName: "  Pampana Hari Sai Ganesh ",
  email: " Hari@Example.com ",
  darkMode: true,
  notifications: { weeklySummary: true, largeTransactionAlerts: false, copilotTips: true },
};

describe("validateSettings (server-side)", () => {
  it("accepts valid input and trims/normalizes it", () => {
    const result = validateSettings(valid);
    expect(result).toEqual({
      ok: true,
      data: { ...valid, fullName: "Pampana Hari Sai Ganesh", email: "hari@example.com" },
    });
  });

  it("requires a name and rejects overly long or control-character names", () => {
    for (const fullName of ["", "   ", undefined, 42]) {
      const r = validateSettings({ ...valid, fullName });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.fullName).toBeTruthy();
    }
    expect(validateSettings({ ...valid, fullName: "a".repeat(101) }).ok).toBe(false);
    expect(validateSettings({ ...valid, fullName: "a".repeat(100) }).ok).toBe(true);
    expect(validateSettings({ ...valid, fullName: "Hari\nGanesh" }).ok).toBe(false);
  });

  it("rejects invalid email addresses", () => {
    for (const email of ["", "hari", "hari@", "@example.com", "hari@example", "ha ri@example.com", `${"a".repeat(250)}@x.com`]) {
      const r = validateSettings({ ...valid, email });
      expect(r.ok, email).toBe(false);
      if (!r.ok) expect(r.errors.email).toBeTruthy();
    }
  });

  it("requires real booleans for toggles", () => {
    expect(validateSettings({ ...valid, darkMode: "true" }).ok).toBe(false);
    expect(validateSettings({ ...valid, notifications: { ...valid.notifications, copilotTips: 1 } }).ok).toBe(false);
    expect(validateSettings({ ...valid, notifications: { weeklySummary: true } }).ok).toBe(false);
    expect(validateSettings({ ...valid, notifications: { ...valid.notifications, extra: true } }).ok).toBe(false);
    expect(validateSettings({ ...valid, notifications: null }).ok).toBe(false);
  });

  it("rejects requests that aren't objects", () => {
    for (const input of [null, undefined, "x", 5, []]) {
      expect(validateSettings(input)).toEqual({ ok: false, errors: { form: "Invalid request." } });
    }
  });
});

describe("saveSettings server action", () => {
  it("validates before accepting", async () => {
    expect((await saveSettings(valid)).ok).toBe(true);
    const bad = await saveSettings({ ...valid, email: "nope" });
    expect(bad.ok).toBe(false);
  });
});
