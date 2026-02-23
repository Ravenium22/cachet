import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Footer } from "./Footer";

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

describe("Footer", () => {
    it("renders copyright text with current year", () => {
        render(<Footer />);
        const year = new Date().getFullYear();
        expect(screen.getByText(new RegExp(`${year}`))).toBeInTheDocument();
    });

    it("renders TERMS, PRIVACY, and REFUNDS links", () => {
        render(<Footer />);
        expect(screen.getByText("TERMS")).toHaveAttribute("href", "/terms");
        expect(screen.getByText("PRIVACY")).toHaveAttribute("href", "/privacy");
        expect(screen.getByText("REFUNDS")).toHaveAttribute("href", "/refund-policy");
    });

    it("highlights TERMS when activePage is terms", () => {
        render(<Footer activePage="terms" />);
        const terms = screen.getByText("TERMS");
        expect(terms.className).toContain("text-brand-white");
        const privacy = screen.getByText("PRIVACY");
        expect(privacy.className).toContain("text-brand-gray");
    });

    it("highlights PRIVACY when activePage is privacy", () => {
        render(<Footer activePage="privacy" />);
        const privacy = screen.getByText("PRIVACY");
        expect(privacy.className).toContain("text-brand-white");
        const terms = screen.getByText("TERMS");
        expect(terms.className).toContain("text-brand-gray");
    });

    it("highlights REFUNDS when activePage is refund-policy", () => {
        render(<Footer activePage="refund-policy" />);
        const refunds = screen.getByText("REFUNDS");
        expect(refunds.className).toContain("text-brand-white");
    });

    it("no links are highlighted when no activePage", () => {
        render(<Footer />);
        expect(screen.getByText("TERMS").className).toContain("text-brand-gray");
        expect(screen.getByText("PRIVACY").className).toContain("text-brand-gray");
        expect(screen.getByText("REFUNDS").className).toContain("text-brand-gray");
    });
});
