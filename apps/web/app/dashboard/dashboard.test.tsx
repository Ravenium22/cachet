import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "./page";

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

const mockLogout = vi.fn();
vi.mock("@/lib/auth", () => ({
    useAuth: () => ({ logout: mockLogout }),
}));

const mockFetch = vi.fn();
vi.mock("@/lib/api", () => ({
    api: {
        getLoginUrl: () => "https://api.test/api/v1/auth/discord",
        fetch: (...args: unknown[]) => mockFetch(...args),
        getUsername: () => "TestUser#1234",
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

const mockProjects = [
    { id: "proj-1", name: "Alpha Project", discordGuildId: "111222333444555666", createdAt: "2026-01-15T00:00:00Z" },
    { id: "proj-2", name: "Beta Project", discordGuildId: "222333444555666777", createdAt: "2026-02-10T00:00:00Z" },
];

describe("DashboardPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("C1: project count", () => {
        it("shows count when projects exist", async () => {
            mockFetch.mockImplementation((path: string) => {
                if (path === "/api/v1/projects") return Promise.resolve(mockProjects);
                if (path.includes("/api/v1/billing/subscription")) return Promise.resolve({ tier: "free", status: "active" });
                return Promise.resolve(null);
            });
            renderWithProviders(<DashboardPage />);
            await waitFor(() => {
                expect(screen.getByText("Your Projects (2)")).toBeInTheDocument();
            });
        });

        it("does not show count when no projects", async () => {
            mockFetch.mockResolvedValue([]);
            renderWithProviders(<DashboardPage />);
            await waitFor(() => {
                expect(screen.getByText("Your Projects")).toBeInTheDocument();
            });
            expect(screen.queryByText(/Your Projects \(/)).not.toBeInTheDocument();
        });
    });

    describe("C2: tier badges", () => {
        it("shows tier badge on project cards", async () => {
            mockFetch.mockImplementation((path: string) => {
                if (path === "/api/v1/projects") return Promise.resolve(mockProjects);
                if (path.includes("proj-1") && path.includes("billing")) return Promise.resolve({ tier: "growth", status: "active" });
                if (path.includes("proj-2") && path.includes("billing")) return Promise.resolve({ tier: "free", status: "active" });
                return Promise.resolve(null);
            });
            renderWithProviders(<DashboardPage />);
            await waitFor(() => {
                expect(screen.getByText("GROWTH")).toBeInTheDocument();
            });
            expect(screen.getByText("FREE")).toBeInTheDocument();
        });
    });

    describe("C3: empty state", () => {
        it("shows improved empty state with CTA", async () => {
            mockFetch.mockResolvedValue([]);
            renderWithProviders(<DashboardPage />);
            await waitFor(() => {
                expect(screen.getByText("NO PROJECTS YET")).toBeInTheDocument();
            });
            expect(screen.getByText("CREATE YOUR FIRST PROJECT")).toBeInTheDocument();
            expect(screen.getByText(/Create a project to connect/)).toBeInTheDocument();
        });

        it("clicking CTA opens create form", async () => {
            mockFetch.mockResolvedValue([]);
            renderWithProviders(<DashboardPage />);
            await waitFor(() => {
                expect(screen.getByText("CREATE YOUR FIRST PROJECT")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("CREATE YOUR FIRST PROJECT"));
            expect(screen.getByText("Create Project")).toBeInTheDocument();
        });
    });

    describe("C4: user profile", () => {
        it("shows username near logout button", async () => {
            mockFetch.mockResolvedValue([]);
            renderWithProviders(<DashboardPage />);
            expect(screen.getByText("TestUser#1234")).toBeInTheDocument();
        });
    });
});
