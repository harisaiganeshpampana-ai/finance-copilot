import { vi } from "vitest";

// Component tests render app pages as a logged-in user. Real login is tested in auth tests.
export const TEST_SESSION_USER = { name: "Hari Sai Ganesh", email: "hari@example.com" };

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: unknown }) => children,
  useSession: () => ({ data: { user: TEST_SESSION_USER, expires: "2099-01-01" }, status: "authenticated" }),
  signIn: vi.fn(async () => ({ ok: true, error: null, status: 200, url: "/dashboard" })),
  signOut: vi.fn(async () => undefined),
}));
