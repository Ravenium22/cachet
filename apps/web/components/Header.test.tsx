import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Header } from "./Header";

// Mock next/link
vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

// Mock auth and api
const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/api", () => ({
    api: {
        getLoginUrl: () => "https://api.test/api/v1/auth/discord",
    },
}));

describe("Header", () => {
    beforeEach(() => {
        mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    });

    it("renders logo as a link to homepage", () => {
        render(<Header />);
        const logo = screen.getByText("cachet.");
        expect(logo.closest("a")).toHaveAttribute("href", "/");
    });

    it("renders PRICING link", () => {
        render(<Header />);
        expect(screen.getByText("PRICING")).toHaveAttribute("href", "/pricing");
    });

    it("does not render auth links when showAuth is false", () => {
        render(<Header />);
        expect(screen.queryByText("LOGIN")).not.toBeInTheDocument();
        expect(screen.queryByText("DASHBOARD")).not.toBeInTheDocument();
    });

    it("renders LOGIN link when showAuth is true and not authenticated", () => {
        render(<Header showAuth />);
        const login = screen.getByText("LOGIN");
        expect(login).toHaveAttribute("href", "https://api.test/api/v1/auth/discord");
    });

    it("renders DASHBOARD link when showAuth is true and authenticated", () => {
        mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
        render(<Header showAuth />);
        expect(screen.getByText("DASHBOARD")).toHaveAttribute("href", "/dashboard");
        expect(screen.queryByText("LOGIN")).not.toBeInTheDocument();
    });

    it("highlights PRICING when activePage is pricing", () => {
        render(<Header activePage="pricing" />);
        const pricing = screen.getByText("PRICING");
        expect(pricing.className).toContain("text-brand-white");
        expect(pricing.className).not.toContain("text-brand-gray");
    });

    it("PRICING is gray by default", () => {
        render(<Header />);
        const pricing = screen.getByText("PRICING");
        expect(pricing.className).toContain("text-brand-gray");
    });
});
