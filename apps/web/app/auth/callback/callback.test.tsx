import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AuthCallbackPage from "./page";

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(""),
}));

describe("AuthCallbackPage", () => {
    it("renders with brand-styled loading text", () => {
        render(<AuthCallbackPage />);
        expect(screen.getByText("COMPLETING_LOGIN...")).toBeInTheDocument();
    });

    it("uses brand-gray for Suspense fallback, not raw gray", () => {
        // The Suspense fallback should use text-brand-gray, not text-gray-400
        render(<AuthCallbackPage />);
        const text = screen.getByText("COMPLETING_LOGIN...");
        expect(text.className).toContain("text-brand-gray");
    });

    it("has bg-brand-black on main element", () => {
        render(<AuthCallbackPage />);
        const main = screen.getByText("COMPLETING_LOGIN...").closest("main");
        expect(main?.className).toContain("bg-brand-black");
    });
});
