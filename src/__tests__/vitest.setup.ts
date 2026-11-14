import { vi } from "vitest";

// Component tests render app pages as a logged-in user. Real login is tested in auth tests.
export const TEST_SESSION_USER = { name: "Hari Sai Ganesh", email: "hari@example.com" };

// The sidebar syncs the user's saved bank connection from the server on load. By default in
// component tests: no bank connected. Tests can override with vi.mocked(...).
vi.mock("@/app/(app)/bank-actions", () => ({
  getBankConnectionStatus: vi.fn(async () => null),
  disconnectBank: vi.fn(async () => ({ ok: true })),
}));

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: unknown }) => children,
  useSession: () => ({ data: { user: TEST_SESSION_USER, expires: "2099-01-01" }, status: "authenticated" }),
  signIn: vi.fn(async () => ({ ok: true, error: null, status: 200, url: "/dashboard" })),
  signOut: vi.fn(async () => undefined),
}));
