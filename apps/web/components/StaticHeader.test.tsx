import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StaticHeader } from "./StaticHeader";

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

describe("StaticHeader", () => {
    it("renders logo as a link to homepage", () => {
        render(<StaticHeader />);
        const logo = screen.getByText("cachet.");
        expect(logo.closest("a")).toHaveAttribute("href", "/");
    });

    it("renders PRICING link", () => {
        render(<StaticHeader />);
        expect(screen.getByText("PRICING")).toHaveAttribute("href", "/pricing");
    });

    it("does not render LOGIN or DASHBOARD", () => {
        render(<StaticHeader />);
        expect(screen.queryByText("LOGIN")).not.toBeInTheDocument();
        expect(screen.queryByText("DASHBOARD")).not.toBeInTheDocument();
    });
});
