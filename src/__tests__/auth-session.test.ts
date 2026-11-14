import { afterEach, describe, expect, it, vi } from "vitest";

const nextAuth = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => nextAuth);
vi.mock("next-auth/providers/credentials", () => ({ default: (opts: unknown) => opts }));

import { getCurrentUser } from "@/lib/auth/session";

afterEach(() => vi.restoreAllMocks());

describe("getCurrentUser", () => {
  it("returns the session user when logged in", async () => {
    nextAuth.getServerSession.mockResolvedValueOnce({ user: { name: "Hari", email: "hari@example.com" } });
    expect(await getCurrentUser()).toEqual({ name: "Hari", email: "hari@example.com" });
  });

  it("returns null when logged out", async () => {
    nextAuth.getServerSession.mockResolvedValueOnce(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("fails closed (null, no crash) if the session can't be read, e.g. missing secret", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    nextAuth.getServerSession.mockRejectedValueOnce(new Error("NO_SECRET"));
    expect(await getCurrentUser()).toBeNull();
  });
});
