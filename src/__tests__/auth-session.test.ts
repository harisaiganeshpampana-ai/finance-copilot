import { afterEach, describe, expect, it, vi } from "vitest";

const nextAuth = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => nextAuth);
vi.mock("next-auth/providers/credentials", () => ({ default: (opts: unknown) => opts }));

import { getCurrentUser } from "@/lib/auth/session";

afterEach(() => vi.restoreAllMocks());

describe("getCurrentUser", () => {
  it("returns the session user (with their database id) when logged in", async () => {
    nextAuth.getServerSession.mockResolvedValueOnce({
      user: { id: "64b0000000000000000000aa", name: "Hari", email: "hari@example.com" },
    });
    expect(await getCurrentUser()).toEqual({ id: "64b0000000000000000000aa", name: "Hari", email: "hari@example.com" });
  });

  it("treats a session without a user id as logged out", async () => {
    nextAuth.getServerSession.mockResolvedValueOnce({ user: { name: "Hari", email: "hari@example.com" } });
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null when logged out", async () => {
    nextAuth.getServerSession.mockResolvedValueOnce(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("passes Next.js internal signals through instead of swallowing them", async () => {
    const nextSignal = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    nextAuth.getServerSession.mockRejectedValueOnce(nextSignal);
    await expect(getCurrentUser()).rejects.toBe(nextSignal);
  });

  it("fails closed (null, no crash) if the session can't be read, e.g. missing secret", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    nextAuth.getServerSession.mockRejectedValueOnce(new Error("NO_SECRET"));
    expect(await getCurrentUser()).toBeNull();
  });
});
