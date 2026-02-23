import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

// Use an object so the mock closure can read the latest value
const nav = { pathname: "/dashboard/proj-1" };

vi.mock("next/navigation", () => ({
    useParams: () => ({ projectId: "proj-1" }),
    usePathname: () => nav.pathname,
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => ({ logout: vi.fn() }),
}));

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

// Dynamic import so each test gets fresh module state with the right pathname
async function renderLayout(pathname: string) {
    nav.pathname = pathname;
    // Re-import to get fresh component with updated pathname
    const { default: ProjectLayout } = await import("./layout");
    renderWithProviders(<ProjectLayout><div>child</div></ProjectLayout>);
}

describe("ProjectLayout breadcrumbs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockResolvedValue({ id: "proj-1", name: "Test Project", discordGuildId: "123" });
        nav.pathname = "/dashboard/proj-1";
    });

    it("renders breadcrumb with Dashboard link on overview", async () => {
        await renderLayout("/dashboard/proj-1");
        await waitFor(() => {
            expect(screen.getByText("Dashboard")).toBeInTheDocument();
        });
        expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("href", "/dashboard");
        // Project name appears in breadcrumb (and sidebar) - use getAllByText
        const projectLinks = screen.getAllByText("Test Project");
        const breadcrumbLink = projectLinks.find((el) => el.closest("a")?.getAttribute("href") === "/dashboard/proj-1");
        expect(breadcrumbLink).toBeTruthy();
    });

    it("shows page name in breadcrumb on contracts page", async () => {
        await renderLayout("/dashboard/proj-1/contracts");
        await waitFor(() => {
            expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
        });
        const breadcrumb = screen.getByLabelText("Breadcrumb");
        expect(breadcrumb.textContent).toContain("Contracts");
        expect(breadcrumb.textContent).toContain("Dashboard");
    });

    it("shows page name in breadcrumb on settings page", async () => {
        await renderLayout("/dashboard/proj-1/settings");
        await waitFor(() => {
            expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
        });
        const breadcrumb = screen.getByLabelText("Breadcrumb");
        expect(breadcrumb.textContent).toContain("Settings");
    });

    it("renders sidebar nav items", async () => {
        await renderLayout("/dashboard/proj-1");
        await waitFor(() => {
            expect(screen.getByText("Overview")).toBeInTheDocument();
        });
        expect(screen.getByText("Verifications")).toBeInTheDocument();
        expect(screen.getByText("Role Mappings")).toBeInTheDocument();
    });

    it("renders All Projects link in sidebar", async () => {
        await renderLayout("/dashboard/proj-1");
        await waitFor(() => {
            expect(screen.getByText("All Projects")).toBeInTheDocument();
        });
        expect(screen.getByText("All Projects").closest("a")).toHaveAttribute("href", "/dashboard");
    });
});
