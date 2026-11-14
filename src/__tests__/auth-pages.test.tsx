// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  useSearchParams: () => nav.params,
  usePathname: () => "/dashboard",
}));

const actions = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock("@/app/(auth)/signup/actions", () => actions);

import { signIn, signOut } from "next-auth/react";
import LoginPage from "@/app/(auth)/login/page";
import SignupPage from "@/app/(auth)/signup/page";
import AppLayout from "@/app/(app)/layout";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MOCK_FINANCIAL_DATA } from "@/data/mockTransactions";

// The dashboard as it renders for a user whose data is the original mock data.
const Dashboard = () => <DashboardView data={MOCK_FINANCIAL_DATA} />;

beforeAll(installBrowserStubs);
beforeEach(() => {
  nav.params = new URLSearchParams();
  vi.mocked(signIn).mockResolvedValue({ ok: true, error: null, status: 200, url: "/dashboard" });
  actions.signUp.mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Continue with Google", () => {
  const withGoogle = () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  };
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["/login", LoginPage],
    ["/signup", SignupPage],
  ])("%s shows the Google button with the Google logo, above an 'or' divider", (_path, Page) => {
    withGoogle();
    const { container } = render(<Page />);
    const button = screen.getByRole("button", { name: "Continue with Google" });
    expect(button.querySelector("[data-google-logo]")).not.toBeNull();
    const divider = screen.getByRole("separator", { name: "or" });
    // Google button comes first, then the divider, then the email field.
    const order = [button, divider, screen.getByLabelText("Email")].map((el) =>
      [...container.querySelectorAll("*")].indexOf(el),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("starts Google sign-in and returns to the requested page", () => {
    withGoogle();
    nav.params = new URLSearchParams("callbackUrl=/copilot");
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/copilot" });
    expect(screen.getByRole("button", { name: /redirecting to google/i })).toBeTruthy();
  });

  it("is hidden when Google isn't configured on the server", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    render(<LoginPage />);
    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
    expect(screen.queryByRole("separator", { name: "or" })).toBeNull();
  });

  it("shows a friendly message when Google sign-in comes back with an error", () => {
    nav.params = new URLSearchParams("error=AccessDenied");
    render(<LoginPage />);
    expect(screen.getByRole("alert").textContent).toMatch(/Google sign-in was cancelled/);
  });
});

describe("/login", () => {
  it("renders the branded login form", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("password");
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/signup");
  });

  it("signs in with email and password, then goes to the dashboard", async () => {
    render(<LoginPage />);
    type("Email", " hari@example.com ");
    type("Password", "calmowe123");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard"));
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "hari@example.com",
      password: "calmowe123",
      redirect: false,
      callbackUrl: "/dashboard",
    });
  });

  it("returns to the page the user originally wanted (safe paths only)", async () => {
    nav.params = new URLSearchParams("callbackUrl=/copilot");
    render(<LoginPage />);
    type("Email", "hari@example.com");
    type("Password", "calmowe123");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/copilot"));
  });

  it("ignores off-site callback URLs", async () => {
    nav.params = new URLSearchParams("callbackUrl=https://evil.example");
    render(<LoginPage />);
    type("Email", "hari@example.com");
    type("Password", "calmowe123");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows an error for wrong credentials", async () => {
    vi.mocked(signIn).mockResolvedValueOnce({ ok: false, error: "CredentialsSignin", status: 401, url: null });
    render(<LoginPage />);
    type("Email", "hari@example.com");
    type("Password", "wrong");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect email or password.");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("asks for both fields before contacting the server", async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/enter your email and password/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("can show and hide the password", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");
  });
});

describe("/signup", () => {
  it("renders the branded sign-up form with legal links", () => {
    render(<SignupPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Create your account" })).toBeTruthy();
    for (const label of ["Full name", "Email", "Password"]) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login");
  });

  it("creates the account on the server, signs in, and opens the dashboard", async () => {
    render(<SignupPage />);
    type("Full name", "Hari Sai Ganesh");
    type("Email", "hari@example.com");
    type("Password", "calmowe123");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard"));
    expect(actions.signUp).toHaveBeenCalledWith({ name: "Hari Sai Ganesh", email: "hari@example.com", password: "calmowe123" });
    expect(signIn).toHaveBeenCalledWith("credentials", expect.objectContaining({ email: "hari@example.com", redirect: false }));
  });

  it("shows server validation errors next to the fields", async () => {
    actions.signUp.mockResolvedValueOnce({ ok: false, errors: { email: "An account with this email already exists. Log in instead." } });
    render(<SignupPage />);
    type("Full name", "Hari");
    type("Email", "hari@example.com");
    type("Password", "calmowe123");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/already exists/)).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows live password requirements", () => {
    render(<SignupPage />);
    type("Password", "abc");
    const reqs = within(screen.getByRole("list", { name: "Password requirements" }));
    expect(reqs.getByText("At least 8 characters").className).toContain("text-zinc-500");
    type("Password", "abcdefg1");
    expect(reqs.getByText("At least 8 characters").className).toContain("text-emerald-400");
    expect(reqs.getByText("At least one letter and one number").className).toContain("text-emerald-400");
  });
});

describe("app sidebar", () => {
  const renderApp = () =>
    render(
      <AppLayout>
        <Dashboard />
      </AppLayout>,
    );

  it("greets the logged-in user and shows their name and email", () => {
    renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back, Hari" })).toBeTruthy();
    expect(screen.getByText("hari@example.com")).toBeTruthy();
  });

  it("has a Log Out button that signs out and returns to /login", () => {
    renderApp();
    const buttons = screen.getAllByRole("button", { name: "Log Out" });
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
