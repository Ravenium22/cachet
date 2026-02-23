import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({ projectId: "proj-1" }),
}));

const mockFetch = vi.fn();
vi.mock("@/lib/api", () => ({
    api: {
        fetch: (...args: unknown[]) => mockFetch(...args),
    },
}));

// Mock recharts to avoid rendering issues in test env
vi.mock("recharts", () => ({
    AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
}

const emptyStats = {
    totalVerifications: 0,
    activeVerifications: 0,
    recentVerifications: 0,
    recentActivity: [] as { id: string; eventType: string; details: Record<string, unknown>; createdAt: string; userDiscordId: string; walletAddress: string }[],
};

const populatedStats = {
    totalVerifications: 150,
    activeVerifications: 120,
    recentVerifications: 30,
    recentActivity: [
        {
            id: "act-1",
            eventType: "verified",
            details: {},
            createdAt: new Date(Date.now() - 3600_000).toISOString(), // 1h ago
            userDiscordId: "user-1",
            walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        },
    ],
};

describe("OverviewPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    async function importAndRender(statsData = emptyStats, daily: unknown[] = [], contracts: unknown[] = [], roles: unknown[] = []) {
        mockFetch.mockImplementation((path: string) => {
            if (path.includes("/verifications/stats")) return Promise.resolve(statsData);
            if (path.includes("/verifications/daily")) return Promise.resolve(daily);
            if (path.includes("/contracts")) return Promise.resolve(contracts);
            if (path.includes("/roles")) return Promise.resolve(roles);
            return Promise.resolve(null);
        });
        const { default: OverviewPage } = await import("./page");
        renderWithProviders(<OverviewPage />);
    }

    describe("D1: responsive stats cards", () => {
        it("uses responsive grid classes", async () => {
            await importAndRender();
            await waitFor(() => {
                expect(screen.getByText("TOTAL_VERIFICATIONS")).toBeInTheDocument();
            });
            const grid = screen.getByText("TOTAL_VERIFICATIONS").closest("div")?.parentElement;
            expect(grid?.className).toContain("grid-cols-1");
            expect(grid?.className).toContain("sm:grid-cols-3");
        });
    });

    describe("D2: empty chart CTA", () => {
        it("shows helpful message when no chart data", async () => {
            await importAndRender();
            await waitFor(() => {
                expect(screen.getByText("NO VERIFICATION DATA YET")).toBeInTheDocument();
            });
            expect(screen.getByText(/Set up contracts and role mappings/)).toBeInTheDocument();
        });

        it("shows chart when data exists", async () => {
            await importAndRender(emptyStats, [{ date: "2026-02-22", count: 5 }]);
            await waitFor(() => {
                expect(screen.getByTestId("area-chart")).toBeInTheDocument();
            });
        });
    });

    describe("D3: View all link", () => {
        it("shows VIEW ALL link to verifications", async () => {
            await importAndRender();
            await waitFor(() => {
                expect(screen.getByText("VIEW ALL")).toBeInTheDocument();
            });
            expect(screen.getByText("VIEW ALL").closest("a")).toHaveAttribute("href", "/dashboard/proj-1/verifications");
        });
    });

    describe("D4: relative timestamps", () => {
        it("shows relative time for activity log entries", async () => {
            await importAndRender(populatedStats);
            await waitFor(() => {
                expect(screen.getByText("1h ago")).toBeInTheDocument();
            });
        });
    });

    describe("D5: quick-action cards", () => {
        it("shows 'Add your first contract' when no contracts", async () => {
            await importAndRender(emptyStats, [], [], []);
            await waitFor(() => {
                expect(screen.getByText("Add your first contract")).toBeInTheDocument();
            });
            expect(screen.getByText("Add your first contract").closest("a")).toHaveAttribute("href", "/dashboard/proj-1/contracts");
        });

        it("shows 'Set up role mappings' when no roles", async () => {
            await importAndRender(emptyStats, [], [], []);
            await waitFor(() => {
                expect(screen.getByText("Set up role mappings")).toBeInTheDocument();
            });
            expect(screen.getByText("Set up role mappings").closest("a")).toHaveAttribute("href", "/dashboard/proj-1/roles");
        });

        it("hides quick actions when contracts and roles exist", async () => {
            await importAndRender(emptyStats, [], [{ id: "c1" }], [{ id: "r1" }]);
            await waitFor(() => {
                expect(screen.getByText("TOTAL_VERIFICATIONS")).toBeInTheDocument();
            });
            expect(screen.queryByText("Add your first contract")).not.toBeInTheDocument();
            expect(screen.queryByText("Set up role mappings")).not.toBeInTheDocument();
        });
    });
});
