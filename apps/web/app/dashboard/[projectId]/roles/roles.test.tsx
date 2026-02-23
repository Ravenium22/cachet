import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RoleMappingsPage from "./page";

vi.mock("next/navigation", () => ({
    useParams: () => ({ projectId: "proj-1" }),
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

const mockContracts = [
    { id: "c1", contractAddress: "0xabcdef1234567890abcdef1234567890abcdef12", contractType: "erc721" as const, name: "Test NFT" },
    { id: "c2", contractAddress: "0x1111111111111111111111111111111111111111", contractType: "erc1155" as const, name: "Multi Token" },
];

const mockDiscordRoles = [
    { id: "role-1", name: "Holder", color: 3066993, position: 1 },  // green-ish: #2ECC71
    { id: "role-2", name: "VIP", color: 0, position: 2 },           // no color
];

const mockMappings = [
    {
        id: "m1",
        contractId: "c1",
        discordRoleId: "role-1",
        minNftCount: 1,
        tokenIds: null,
        contractAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        contractType: "erc721",
        contractName: "Test NFT",
    },
];

describe("RoleMappingsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockImplementation((path: string) => {
            if (path.includes("/discord-roles")) return Promise.resolve(mockDiscordRoles);
            if (path.includes("/roles")) return Promise.resolve(mockMappings);
            if (path.includes("/contracts")) return Promise.resolve(mockContracts);
            return Promise.resolve(null);
        });
    });

    describe("F1: Discord role color display", () => {
        it("shows colored dot for roles with non-zero color", async () => {
            renderWithProviders(<RoleMappingsPage />);
            await waitFor(() => {
                expect(screen.getByText("Holder")).toBeInTheDocument();
            });
            const colorDot = screen.getByTitle("Discord role color");
            expect(colorDot).toBeInTheDocument();
            expect(colorDot.style.backgroundColor).toBeTruthy();
        });
    });

    describe("F2: role name loading state", () => {
        it("shows loading placeholder when roles haven't loaded", async () => {
            mockFetch.mockImplementation((path: string) => {
                if (path.includes("/discord-roles")) return new Promise(() => {}); // never resolves
                if (path.includes("/roles")) return Promise.resolve(mockMappings);
                if (path.includes("/contracts")) return Promise.resolve(mockContracts);
                return Promise.resolve(null);
            });
            renderWithProviders(<RoleMappingsPage />);
            await waitFor(() => {
                expect(screen.getByText(/CONTRACT:/)).toBeInTheDocument();
            });
            // Role name should not show the raw ID
            expect(screen.queryByText("role-1")).not.toBeInTheDocument();
        });
    });

    describe("F3: edit functionality", () => {
        it("shows EDIT button on each mapping card", async () => {
            renderWithProviders(<RoleMappingsPage />);
            await waitFor(() => {
                expect(screen.getByText("EDIT")).toBeInTheDocument();
            });
        });

        it("shows inline edit form when EDIT is clicked", async () => {
            renderWithProviders(<RoleMappingsPage />);
            await waitFor(() => {
                expect(screen.getByText("EDIT")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("EDIT"));
            expect(screen.getByText("SAVE")).toBeInTheDocument();
            expect(screen.getByText("CANCEL")).toBeInTheDocument();
        });

        it("cancels edit mode when CANCEL is clicked", async () => {
            renderWithProviders(<RoleMappingsPage />);
            await waitFor(() => {
                expect(screen.getByText("EDIT")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("EDIT"));
            fireEvent.click(screen.getByText("CANCEL"));
            expect(screen.getByText("EDIT")).toBeInTheDocument();
            expect(screen.queryByText("SAVE")).not.toBeInTheDocument();
        });

        it("calls PATCH API when SAVE is clicked", async () => {
            mockFetch.mockImplementation((path: string, opts?: { method?: string }) => {
                if (opts?.method === "PATCH") return Promise.resolve({});
                if (path.includes("/discord-roles")) return Promise.resolve(mockDiscordRoles);
                if (path.includes("/roles")) return Promise.resolve(mockMappings);
                if (path.includes("/contracts")) return Promise.resolve(mockContracts);
                return Promise.resolve(null);
            });
            renderWithProviders(<RoleMappingsPage />);
            await waitFor(() => {
                expect(screen.getByText("EDIT")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("EDIT"));
            fireEvent.click(screen.getByText("SAVE"));
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    "/api/v1/projects/proj-1/roles/m1",
                    expect.objectContaining({ method: "PATCH" }),
                );
            });
        });
    });

    describe("F5: select validation", () => {
        it("shows error when submitting without selecting a contract", async () => {
            renderWithProviders(<RoleMappingsPage />);
            fireEvent.click(screen.getByText("CREATE MAPPING"));
            // Submit without selecting anything
            const form = screen.getByText("CREATE MAPPING", { selector: "button[type='submit']" });
            fireEvent.click(form);
            expect(screen.getByText("Please select a contract")).toBeInTheDocument();
        });

        it("clears validation error when a contract is selected", async () => {
            renderWithProviders(<RoleMappingsPage />);
            fireEvent.click(screen.getByText("CREATE MAPPING"));
            const submitBtn = screen.getByText("CREATE MAPPING", { selector: "button[type='submit']" });
            fireEvent.click(submitBtn);
            expect(screen.getByText("Please select a contract")).toBeInTheDocument();
            // Select a contract — error should clear
            await waitFor(() => {
                expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(2);
            });
            const selects = screen.getAllByRole("combobox");
            fireEvent.change(selects[0], { target: { value: "c1" } });
            expect(screen.queryByText("Please select a contract")).not.toBeInTheDocument();
        });
    });

    describe("delete confirmation", () => {
        it("shows CONFIRM/CANCEL after clicking DELETE", async () => {
            renderWithProviders(<RoleMappingsPage />);
            await waitFor(() => {
                expect(screen.getByText("DELETE")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("DELETE"));
            expect(screen.getByText("CONFIRM")).toBeInTheDocument();
            expect(screen.queryByText("DELETE")).not.toBeInTheDocument();
        });

        it("hides confirmation when CANCEL clicked", async () => {
            renderWithProviders(<RoleMappingsPage />);
            await waitFor(() => {
                expect(screen.getByText("DELETE")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("DELETE"));
            // There are two CANCELs potentially visible - the delete cancel
            const cancelButtons = screen.getAllByText("CANCEL");
            fireEvent.click(cancelButtons[cancelButtons.length - 1]);
            expect(screen.getByText("DELETE")).toBeInTheDocument();
        });
    });

    describe("mapping card rendering", () => {
        it("renders mapping info", async () => {
            renderWithProviders(<RoleMappingsPage />);
            await waitFor(() => {
                expect(screen.getByText("Holder")).toBeInTheDocument();
            });
            expect(screen.getByText(/CONTRACT: Test NFT/)).toBeInTheDocument();
            expect(screen.getByText(/MIN: 1 NFT/)).toBeInTheDocument();
        });
    });
});
