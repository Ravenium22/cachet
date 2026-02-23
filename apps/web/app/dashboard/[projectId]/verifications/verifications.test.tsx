import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VerificationsPage from "./page";

vi.mock("next/navigation", () => {
    const nav = { pathname: "/dashboard/proj-1/verifications", search: "" };
    return {
        useParams: () => ({ projectId: "proj-1" }),
        useSearchParams: () => new URLSearchParams(nav.search),
        useRouter: () => ({
            push: (url: string) => { nav.search = url.split("?")[1] ?? ""; },
        }),
    };
});

const mockFetch = vi.fn();
vi.mock("@/lib/api", () => ({
    api: {
        fetch: (...args: unknown[]) => mockFetch(...args),
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

const mockVerifications = [
    {
        id: "v1",
        userDiscordId: "user-123",
        walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        rolesGranted: ["role-1"],
        verifiedAt: "2026-02-20T12:00:00Z",
        lastChecked: "2026-02-22T12:00:00Z",
        status: "active" as const,
    },
    {
        id: "v2",
        userDiscordId: "user-456",
        walletAddress: "0x1111222233334444555566667777888899990000",
        rolesGranted: [],
        verifiedAt: "2026-02-19T12:00:00Z",
        lastChecked: "2026-02-22T12:00:00Z",
        status: "expired" as const,
    },
];

const mockPaginated = {
    items: mockVerifications,
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

const mockAllData = {
    items: mockVerifications,
    pagination: { page: 1, limit: 1000, total: 2, totalPages: 1 },
};

describe("VerificationsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockImplementation((path: string) => {
            if (path.includes("limit=1000")) return Promise.resolve(mockAllData);
            if (path.includes("/verifications")) return Promise.resolve(mockPaginated);
            return Promise.resolve(null);
        });
    });

    describe("G1+G2: dead code removed, brand styles used", () => {
        it("renders with brand-styled heading", async () => {
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByText("Verifications")).toBeInTheDocument();
            });
            const heading = screen.getByText("Verifications");
            expect(heading.className).toContain("text-brand-white");
        });

        it("renders verifications table with brand styles", async () => {
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByText("user-123")).toBeInTheDocument();
            });
        });
    });

    describe("G3: debounced search", () => {
        it("has search input without a separate search button", async () => {
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search by wallet or Discord ID...")).toBeInTheDocument();
            });
            // Search button was removed in favor of debounce
            expect(screen.queryByText("SEARCH")).not.toBeInTheDocument();
        });

        it("updates search input on change", async () => {
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search by wallet or Discord ID...")).toBeInTheDocument();
            });
            const input = screen.getByPlaceholderText("Search by wallet or Discord ID...");
            fireEvent.change(input, { target: { value: "0xabc" } });
            expect(input).toHaveValue("0xabc");
        });
    });

    describe("G4: copyable wallet addresses", () => {
        it("shows wallet addresses as clickable buttons", async () => {
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByText("user-123")).toBeInTheDocument();
            });
            const copyBtns = screen.getAllByTitle("Click to copy full address");
            expect(copyBtns.length).toBe(2);
        });
    });

    describe("G5: CSV export", () => {
        it("shows EXPORT CSV button when data exists", async () => {
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByText("EXPORT CSV")).toBeInTheDocument();
            });
        });

        it("does not show EXPORT CSV when no data", async () => {
            mockFetch.mockImplementation(() =>
                Promise.resolve({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
            );
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByText("NO_VERIFICATIONS_FOUND")).toBeInTheDocument();
            });
            expect(screen.queryByText("EXPORT CSV")).not.toBeInTheDocument();
        });
    });

    describe("G6: status filter badges", () => {
        it("shows counts in status filter dropdown", async () => {
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByText("user-123")).toBeInTheDocument();
            });
            const select = screen.getByRole("combobox");
            // Check that options contain counts
            const options = Array.from(select.querySelectorAll("option"));
            const allOption = options.find((o) => o.textContent?.includes("ALL_STATUSES"));
            expect(allOption?.textContent).toContain("(2)");
            const activeOption = options.find((o) => o.textContent?.includes("ACTIVE"));
            expect(activeOption?.textContent).toContain("(1)");
            const expiredOption = options.find((o) => o.textContent?.includes("EXPIRED"));
            expect(expiredOption?.textContent).toContain("(1)");
        });
    });

    describe("G7: reverify inline error", () => {
        it("shows inline error instead of alert on reverify failure", async () => {
            mockFetch.mockImplementation((path: string, opts?: { method?: string }) => {
                if (opts?.method === "POST") return Promise.reject(new Error("NFT check failed"));
                if (path.includes("limit=1000")) return Promise.resolve(mockAllData);
                if (path.includes("/verifications")) return Promise.resolve(mockPaginated);
                return Promise.resolve(null);
            });
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByText("user-123")).toBeInTheDocument();
            });
            const reverifyBtns = screen.getAllByText("RE-VERIFY");
            fireEvent.click(reverifyBtns[0]);
            await waitFor(() => {
                expect(screen.getByText("NFT check failed")).toBeInTheDocument();
            });
        });
    });

    describe("table rendering", () => {
        it("renders verification status badges", async () => {
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByText("active")).toBeInTheDocument();
            });
            expect(screen.getByText("expired")).toBeInTheDocument();
        });

        it("shows truncated wallet addresses", async () => {
            renderWithProviders(<VerificationsPage />);
            await waitFor(() => {
                expect(screen.getByText(/0xabcd.*ef12/)).toBeInTheDocument();
            });
        });
    });
});
