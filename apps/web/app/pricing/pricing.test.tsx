import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PricingPage from "./page";

// Mock next/link
vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

// Mock auth
const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
    useAuth: () => mockUseAuth(),
}));

// Mock api
const mockFetch = vi.fn();
vi.mock("@/lib/api", () => ({
    api: {
        getLoginUrl: () => "https://api.test/api/v1/auth/discord",
        fetch: (...args: unknown[]) => mockFetch(...args),
    },
}));

// Mock Header and Footer to keep tests focused
vi.mock("@/components/Header", () => ({
    Header: ({ showAuth, activePage }: { showAuth?: boolean; activePage?: string }) => (
        <header data-testid="header" data-show-auth={showAuth} data-active-page={activePage} />
    ),
}));

vi.mock("@/components/Footer", () => ({
    Footer: () => <footer data-testid="footer" />,
}));

function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
}

describe("PricingPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
        mockFetch.mockResolvedValue([]);
    });

    describe("billing interval toggle", () => {
        it("renders MONTHLY and ANNUAL toggle buttons", () => {
            renderWithProviders(<PricingPage />);
            expect(screen.getByText("MONTHLY")).toBeInTheDocument();
            expect(screen.getByText("ANNUAL")).toBeInTheDocument();
        });

        it("defaults to monthly billing", () => {
            renderWithProviders(<PricingPage />);
            const monthly = screen.getByText("MONTHLY");
            expect(monthly.className).toContain("bg-brand-green");
        });

        it("shows SAVE 20% badge", () => {
            renderWithProviders(<PricingPage />);
            expect(screen.getByText("SAVE 20%")).toBeInTheDocument();
        });

        it("switches to annual billing when clicked", () => {
            renderWithProviders(<PricingPage />);
            const annualBtn = screen.getByText("ANNUAL");
            fireEvent.click(annualBtn);
            expect(annualBtn.className).toContain("bg-brand-green");
        });

        it("shows annual prices with /YR billing note", () => {
            renderWithProviders(<PricingPage />);
            fireEvent.click(screen.getByText("ANNUAL"));
            // Growth annual: $143.90/yr, shown as $11.99/mo
            expect(screen.getByText(/BILLED \$143.9\/YR/)).toBeInTheDocument();
        });
    });

    describe("plan cards", () => {
        it("renders all 4 plan tiers", () => {
            renderWithProviders(<PricingPage />);
            expect(screen.getByText("Free")).toBeInTheDocument();
            expect(screen.getByText("Growth")).toBeInTheDocument();
            expect(screen.getByText("Pro")).toBeInTheDocument();
            expect(screen.getByText("Enterprise")).toBeInTheDocument();
        });

        it("shows MOST POPULAR badge on Growth", () => {
            renderWithProviders(<PricingPage />);
            expect(screen.getByText("MOST POPULAR")).toBeInTheDocument();
        });

        it("shows SERVERS in feature list", () => {
            renderWithProviders(<PricingPage />);
            const serversLabels = screen.getAllByText("SERVERS:");
            expect(serversLabels.length).toBe(4);
        });

        it("shows GET STARTED buttons when not authenticated", () => {
            renderWithProviders(<PricingPage />);
            const buttons = screen.getAllByText("GET STARTED");
            expect(buttons.length).toBe(4);
        });
    });

    describe("current plan highlight (authenticated)", () => {
        beforeEach(() => {
            mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
            mockFetch.mockImplementation((path: string) => {
                if (path === "/api/v1/projects") {
                    return Promise.resolve([{ id: "proj-1", name: "My Project" }]);
                }
                if (path.includes("/api/v1/billing/subscription")) {
                    return Promise.resolve({ tier: "growth", status: "active" });
                }
                return Promise.resolve(null);
            });
        });

        it("shows CURRENT PLAN badge on the user's tier", async () => {
            renderWithProviders(<PricingPage />);
            // Wait for queries to resolve
            const badge = await screen.findByText("CURRENT PLAN", { selector: "p" });
            expect(badge).toBeInTheDocument();
        });

        it("shows MANAGE PLAN links for non-current tiers", async () => {
            renderWithProviders(<PricingPage />);
            await screen.findByText("CURRENT PLAN", { selector: "p" });
            const manageLinks = screen.getAllByText("MANAGE PLAN");
            expect(manageLinks.length).toBeGreaterThan(0);
        });

        it("deeplinks MANAGE PLAN to project settings", async () => {
            renderWithProviders(<PricingPage />);
            await screen.findByText("CURRENT PLAN", { selector: "p" });
            await waitFor(() => {
                const manageLinks = screen.getAllByText("MANAGE PLAN");
                expect(manageLinks[0].closest("a")).toHaveAttribute("href", "/dashboard/proj-1/settings");
            });
        });
    });

    describe("FAQ section", () => {
        it("renders FAQ questions", () => {
            renderWithProviders(<PricingPage />);
            expect(screen.getByText("FREQUENTLY ASKED QUESTIONS")).toBeInTheDocument();
            expect(screen.getByText("CAN I GET A REFUND?")).toBeInTheDocument();
        });

        it("refund FAQ says all sales are final (no contradiction)", () => {
            renderWithProviders(<PricingPage />);
            expect(screen.getByText(/all sales are final/i)).toBeInTheDocument();
        });
    });
});
