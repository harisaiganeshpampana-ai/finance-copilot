// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Dashboard from "@/app/dashboard/page";

afterEach(cleanup);

describe("Dashboard page (/dashboard)", () => {
  it("shows the balance and all 10 mock transactions", () => {
    render(<Dashboard />);
    expect(screen.getByTestId("balance").textContent).toBe("$2,082.54");
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });
});
