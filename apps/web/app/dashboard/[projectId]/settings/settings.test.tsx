import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SettingsPage from "./page";

vi.mock("next/navigation", () => ({
    useParams: () => ({ projectId: "proj-1" }),
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/script", () => ({
    default: () => null,
}));

const mockFetch = vi.fn();
vi.mock("@/lib/api", () => ({
    api: {
        fetch: (...args: unknown[]) => mockFetch(...args),
    },
}));

vi.mock("@/lib/format", () => ({
    formatShortDate: (d: string) => {
        const date = new Date(d);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    },
}));

function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
}

const mockProject = {
    id: "proj-1",
    name: "Test Project",
    discordGuildId: "guild-123",
    verificationChannelId: "chan-456",
    settings: {},
    createdAt: "2026-01-15T12:00:00Z",
    updatedAt: "2026-02-20T12:00:00Z",
};

const mockSubscription = {
    tier: "growth" as const,
    status: "active" as const,
    inGracePeriod: false,
    currentPeriodEnd: "2026-03-15T12:00:00Z",
};

const mockPlans = [
    { tier: "free", label: "Free", priceMonthlyUsd: 0, priceAnnualUsd: 0, limits: { maxVerifiedMembers: 50, maxServers: 1, maxContracts: 1, maxRoleMappings: 2, maxAdminChecksPerMonth: 10 } },
    { tier: "growth", label: "Growth", priceMonthlyUsd: 14.99, priceAnnualUsd: 143.90, limits: { maxVerifiedMembers: 500, maxServers: 3, maxContracts: 5, maxRoleMappings: 10, maxAdminChecksPerMonth: 100 } },
    { tier: "pro", label: "Pro", priceMonthlyUsd: 39.99, priceAnnualUsd: 383.90, limits: { maxVerifiedMembers: 5000, maxServers: 10, maxContracts: 20, maxRoleMappings: 50, maxAdminChecksPerMonth: null } },
    { tier: "enterprise", label: "Enterprise", priceMonthlyUsd: null, priceAnnualUsd: null, limits: { maxVerifiedMembers: null, maxServers: null, maxContracts: null, maxRoleMappings: null, maxAdminChecksPerMonth: null } },
];

const mockStats = {
    data: {
        totalVerifications: 150,
        activeVerifications: 120,
        recentVerifications: 15,
    },
};

describe("SettingsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
        mockFetch.mockImplementation((path: string) => {
            if (path.includes("/verifications/stats")) return Promise.resolve(mockStats);
            if (path.includes("/billing/subscription")) return Promise.resolve(mockSubscription);
            if (path.includes("/billing/plans")) return Promise.resolve(mockPlans);
            if (path.includes("/projects/")) return Promise.resolve(mockProject);
            return Promise.resolve(null);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("H1: usage stats progress bar", () => {
        it("shows verified members usage", async () => {
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByText(/VERIFIED_MEMBERS/)).toBeInTheDocument();
            });
            expect(screen.getByText(/120 \/ 500/)).toBeInTheDocument();
        });
    });

    describe("H2: manage subscription for free tier", () => {
        it("shows MANAGE SUBSCRIPTION for paid tier", async () => {
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByText("MANAGE SUBSCRIPTION")).toBeInTheDocument();
            });
        });

        it("shows message instead of button for free tier", async () => {
            mockFetch.mockImplementation((path: string) => {
                if (path.includes("/verifications/stats")) return Promise.resolve(mockStats);
                if (path.includes("/billing/subscription")) return Promise.resolve({ tier: "free", status: "active", inGracePeriod: false, currentPeriodEnd: "" });
                if (path.includes("/billing/plans")) return Promise.resolve(mockPlans);
                if (path.includes("/projects/")) return Promise.resolve(mockProject);
                return Promise.resolve(null);
            });
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByText(/NO_ACTIVE_SUBSCRIPTION/)).toBeInTheDocument();
            });
            expect(screen.queryByText("MANAGE SUBSCRIPTION")).not.toBeInTheDocument();
        });
    });

    describe("H3: full feature comparison", () => {
        it("shows CONTRACTS, ROLE_MAPPINGS, SERVERS, ADMIN_CHECKS on plan cards", async () => {
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getAllByText(/CONTRACTS:/).length).toBeGreaterThanOrEqual(1);
            });
            expect(screen.getAllByText(/ROLE_MAPPINGS:/).length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText(/SERVERS:/).length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText(/ADMIN_CHECKS:/).length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("H4: human-readable created at", () => {
        it("formats created at date", async () => {
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByText(/Jan 15, 2026/)).toBeInTheDocument();
            });
        });
    });

    describe("H5: auto-dismiss messages", () => {
        it("shows success message with close button", async () => {
            mockFetch.mockImplementation((path: string, opts?: { method?: string }) => {
                if (opts?.method === "PATCH") return Promise.resolve({});
                if (path.includes("/verifications/stats")) return Promise.resolve(mockStats);
                if (path.includes("/billing/subscription")) return Promise.resolve(mockSubscription);
                if (path.includes("/billing/plans")) return Promise.resolve(mockPlans);
                if (path.includes("/projects/")) return Promise.resolve(mockProject);
                return Promise.resolve(null);
            });
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByText("SAVE SETTINGS")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("SAVE SETTINGS"));
            await waitFor(() => {
                expect(screen.getByText("Settings saved.")).toBeInTheDocument();
            });
            // Close button should exist
            const closeBtn = screen.getByText("\u00d7");
            expect(closeBtn).toBeInTheDocument();
            fireEvent.click(closeBtn);
            expect(screen.queryByText("Settings saved.")).not.toBeInTheDocument();
        });

        it("auto-dismisses after 5 seconds", async () => {
            mockFetch.mockImplementation((path: string, opts?: { method?: string }) => {
                if (opts?.method === "PATCH") return Promise.resolve({});
                if (path.includes("/verifications/stats")) return Promise.resolve(mockStats);
                if (path.includes("/billing/subscription")) return Promise.resolve(mockSubscription);
                if (path.includes("/billing/plans")) return Promise.resolve(mockPlans);
                if (path.includes("/projects/")) return Promise.resolve(mockProject);
                return Promise.resolve(null);
            });
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByText("SAVE SETTINGS")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("SAVE SETTINGS"));
            await waitFor(() => {
                expect(screen.getByText("Settings saved.")).toBeInTheDocument();
            });
            act(() => {
                vi.advanceTimersByTime(5500);
            });
            expect(screen.queryByText("Settings saved.")).not.toBeInTheDocument();
        });
    });

    describe("H6: type-to-confirm delete", () => {
        it("shows type-to-confirm input after clicking DELETE PROJECT", async () => {
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByText("DELETE PROJECT")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("DELETE PROJECT"));
            expect(screen.getByText(/TYPE/)).toBeInTheDocument();
            expect(screen.getByPlaceholderText("Test Project")).toBeInTheDocument();
        });

        it("disables CONFIRM DELETE until name matches", async () => {
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByText("DELETE PROJECT")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("DELETE PROJECT"));
            const confirmBtn = screen.getByText("CONFIRM DELETE");
            expect(confirmBtn).toBeDisabled();
            const input = screen.getByPlaceholderText("Test Project");
            fireEvent.change(input, { target: { value: "Test Project" } });
            expect(confirmBtn).not.toBeDisabled();
        });

        it("cancels delete confirmation", async () => {
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByText("DELETE PROJECT")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("DELETE PROJECT"));
            fireEvent.click(screen.getByText("CANCEL"));
            expect(screen.getByText("DELETE PROJECT")).toBeInTheDocument();
        });
    });

    describe("H7: editable verification channel", () => {
        it("shows verification channel as editable input", async () => {
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByDisplayValue("chan-456")).toBeInTheDocument();
            });
            const input = screen.getByDisplayValue("chan-456");
            expect(input).not.toBeDisabled();
        });

        it("can change verification channel value", async () => {
            renderWithProviders(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByDisplayValue("chan-456")).toBeInTheDocument();
            });
            const input = screen.getByDisplayValue("chan-456");
            fireEvent.change(input, { target: { value: "chan-789" } });
            expect(input).toHaveValue("chan-789");
        });
    });
});
