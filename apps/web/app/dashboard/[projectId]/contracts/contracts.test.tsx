import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContractsPage from "./page";

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
    {
        id: "c1",
        contractAddress: "0x1234567890abcdef1234567890abcdef12345678",
        contractType: "erc721" as const,
        name: "Test NFT",
        isActive: true,
        chain: "megaeth",
    },
];

describe("ContractsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockImplementation((path: string) => {
            if (path.includes("/contracts")) return Promise.resolve(mockContracts);
            return Promise.resolve(null);
        });
    });

    describe("E1: delete confirmation", () => {
        it("shows REMOVE button on contract cards", async () => {
            renderWithProviders(<ContractsPage />);
            await waitFor(() => {
                expect(screen.getByText("REMOVE")).toBeInTheDocument();
            });
        });

        it("shows CONFIRM/CANCEL after clicking REMOVE", async () => {
            renderWithProviders(<ContractsPage />);
            await waitFor(() => {
                expect(screen.getByText("REMOVE")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("REMOVE"));
            expect(screen.getByText("CONFIRM")).toBeInTheDocument();
            expect(screen.getByText("CANCEL")).toBeInTheDocument();
            expect(screen.queryByText("REMOVE")).not.toBeInTheDocument();
        });

        it("hides confirmation when CANCEL clicked", async () => {
            renderWithProviders(<ContractsPage />);
            await waitFor(() => {
                expect(screen.getByText("REMOVE")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText("REMOVE"));
            fireEvent.click(screen.getByText("CANCEL"));
            expect(screen.getByText("REMOVE")).toBeInTheDocument();
            expect(screen.queryByText("CONFIRM")).not.toBeInTheDocument();
        });
    });

    describe("E2: inline address validation", () => {
        it("shows validation indicator for invalid partial address", async () => {
            renderWithProviders(<ContractsPage />);
            fireEvent.click(screen.getByText("ADD CONTRACT"));
            const input = screen.getByPlaceholderText("0x...");
            fireEvent.change(input, { target: { value: "0xINVALID" } });
            await waitFor(() => {
                expect(screen.getByText("\u2717")).toBeInTheDocument();
            });
        });

        it("shows green check for valid address", async () => {
            renderWithProviders(<ContractsPage />);
            fireEvent.click(screen.getByText("ADD CONTRACT"));
            const input = screen.getByPlaceholderText("0x...");
            fireEvent.change(input, { target: { value: "0x1234567890abcdef1234567890abcdef12345678" } });
            await waitFor(() => {
                expect(screen.getByText("\u2713")).toBeInTheDocument();
            });
        });

        it("shows error message for too-long address", async () => {
            renderWithProviders(<ContractsPage />);
            fireEvent.click(screen.getByText("ADD CONTRACT"));
            const input = screen.getByPlaceholderText("0x...");
            fireEvent.change(input, { target: { value: "0x1234567890abcdef1234567890abcdef123456789" } });
            expect(screen.getByText("Address too long")).toBeInTheDocument();
        });
    });

    describe("E4: explorer link", () => {
        it("shows explorer link for each contract", async () => {
            renderWithProviders(<ContractsPage />);
            await waitFor(() => {
                expect(screen.getByText("Test NFT")).toBeInTheDocument();
            });
            const explorerLink = screen.getByTitle("View on explorer");
            expect(explorerLink).toHaveAttribute("href", "https://megaexplorer.xyz/address/0x1234567890abcdef1234567890abcdef12345678");
            expect(explorerLink).toHaveAttribute("target", "_blank");
        });
    });

    describe("E3: auto-detect on paste", () => {
        it("triggers auto-detect when valid address is entered and previous was short", async () => {
            mockFetch.mockImplementation((path: string) => {
                if (path.includes("/contracts/detect")) return Promise.resolve({ contractType: "erc721" });
                if (path.includes("/contracts")) return Promise.resolve(mockContracts);
                return Promise.resolve(null);
            });
            renderWithProviders(<ContractsPage />);
            fireEvent.click(screen.getByText("ADD CONTRACT"));
            const input = screen.getByPlaceholderText("0x...");
            // Simulate paste - address goes from empty to full in one change
            fireEvent.change(input, { target: { value: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" } });
            // The auto-detect should fire - we check by verifying the API was called with detect
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    "/api/v1/projects/proj-1/contracts/detect",
                    expect.objectContaining({ method: "POST" }),
                );
            });
        });
    });

    describe("contract cards", () => {
        it("renders contract info", async () => {
            renderWithProviders(<ContractsPage />);
            await waitFor(() => {
                expect(screen.getByText("Test NFT")).toBeInTheDocument();
            });
            expect(screen.getByText("0x1234567890abcdef1234567890abcdef12345678")).toBeInTheDocument();
            expect(screen.getByText(/ERC721/)).toBeInTheDocument();
            expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
        });
    });
});
