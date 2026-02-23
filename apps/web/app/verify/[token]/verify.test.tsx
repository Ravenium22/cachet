import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VerifyClient } from "./VerifyClient";

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSignMessageAsync = vi.fn();

const mockConnectors = [
    { uid: "c1", name: "MetaMask" },
    { uid: "c2", name: "WalletConnect" },
    { uid: "c3", name: "Coinbase Wallet" },
];

vi.mock("wagmi", () => ({
    useAccount: () => ({ address: null, isConnected: false }),
    useConnect: () => ({ connect: mockConnect, connectors: mockConnectors }),
    useDisconnect: () => ({ disconnect: mockDisconnect }),
    useSignMessage: () => ({ signMessageAsync: mockSignMessageAsync }),
}));

describe("VerifyClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultProps = {
        token: "test-token",
        projectName: "Test DAO",
        message: "Sign to verify",
    };

    describe("I1: dynamic connector names/icons", () => {
        it("shows connector names dynamically instead of hardcoded MetaMask", () => {
            render(<VerifyClient {...defaultProps} />);
            expect(screen.getByText("MetaMask")).toBeInTheDocument();
            expect(screen.getByText("WalletConnect")).toBeInTheDocument();
            expect(screen.getByText("Coinbase Wallet")).toBeInTheDocument();
        });
    });

    describe("I2: show all connectors", () => {
        it("renders all available connectors, not just first 2", () => {
            render(<VerifyClient {...defaultProps} />);
            const buttons = screen.getAllByRole("button");
            // Should have 3 connector buttons
            expect(buttons.length).toBe(3);
        });
    });

    describe("I3: show actual role names on success", () => {
        it("displays individual role names instead of count", async () => {
            // Override wagmi to simulate connected state
            const wagmiModule = await import("wagmi");
            vi.spyOn(wagmiModule, "useAccount").mockReturnValue({
                address: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
                isConnected: true,
            } as ReturnType<typeof wagmiModule.useAccount>);

            // Mock successful verification response
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
                        rolesGranted: ["Holder", "VIP Member"],
                        rolesRemoved: [],
                    },
                }),
            });

            mockSignMessageAsync.mockResolvedValue("0xsig");

            render(<VerifyClient {...defaultProps} />);

            // Should be on sign step since connected
            fireEvent.click(screen.getByText("SIGN_AND_VERIFY"));

            await waitFor(() => {
                expect(screen.getByText("VERIFICATION_COMPLETE!")).toBeInTheDocument();
            });

            expect(screen.getByText("+ Holder")).toBeInTheDocument();
            expect(screen.getByText("+ VIP Member")).toBeInTheDocument();
        });
    });

    describe("I4: auto-close countdown", () => {
        it("shows countdown message after success", async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });

            const wagmiModule = await import("wagmi");
            vi.spyOn(wagmiModule, "useAccount").mockReturnValue({
                address: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
                isConnected: true,
            } as ReturnType<typeof wagmiModule.useAccount>);

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
                        rolesGranted: ["Holder"],
                        rolesRemoved: [],
                    },
                }),
            });

            mockSignMessageAsync.mockResolvedValue("0xsig");

            render(<VerifyClient {...defaultProps} />);
            fireEvent.click(screen.getByText("SIGN_AND_VERIFY"));

            await waitFor(() => {
                expect(screen.getByText("VERIFICATION_COMPLETE!")).toBeInTheDocument();
            });

            expect(screen.getByText(/THIS TAB WILL CLOSE IN \d+S/)).toBeInTheDocument();

            vi.useRealTimers();
        });
    });

    describe("I5: differentiate no-NFT warning from errors", () => {
        it("shows warning style for NFT-related errors", async () => {
            const wagmiModule = await import("wagmi");
            vi.spyOn(wagmiModule, "useAccount").mockReturnValue({
                address: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
                isConnected: true,
            } as ReturnType<typeof wagmiModule.useAccount>);

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                json: () => Promise.resolve({
                    success: false,
                    error: "You do not hold the required NFTs",
                }),
            });

            mockSignMessageAsync.mockResolvedValue("0xsig");

            render(<VerifyClient {...defaultProps} />);
            fireEvent.click(screen.getByText("SIGN_AND_VERIFY"));

            await waitFor(() => {
                expect(screen.getByText("NO_NFTS_FOUND")).toBeInTheDocument();
            });
        });

        it("shows error style for non-NFT errors", async () => {
            const wagmiModule = await import("wagmi");
            vi.spyOn(wagmiModule, "useAccount").mockReturnValue({
                address: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
                isConnected: true,
            } as ReturnType<typeof wagmiModule.useAccount>);

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.resolve({
                    success: false,
                    error: "Internal server error",
                }),
            });

            mockSignMessageAsync.mockResolvedValue("0xsig");

            render(<VerifyClient {...defaultProps} />);
            fireEvent.click(screen.getByText("SIGN_AND_VERIFY"));

            await waitFor(() => {
                expect(screen.getByText("VERIFICATION_FAILED")).toBeInTheDocument();
            });
        });
    });

    describe("general rendering", () => {
        it("renders project name in header", () => {
            render(<VerifyClient {...defaultProps} />);
            expect(screen.getByText(/VERIFY FOR Test DAO/)).toBeInTheDocument();
        });

        it("shows TRY_AGAIN button on error", async () => {
            const wagmiModule = await import("wagmi");
            vi.spyOn(wagmiModule, "useAccount").mockReturnValue({
                address: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
                isConnected: true,
            } as ReturnType<typeof wagmiModule.useAccount>);

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ success: false, error: "Server error" }),
            });

            mockSignMessageAsync.mockResolvedValue("0xsig");

            render(<VerifyClient {...defaultProps} />);
            fireEvent.click(screen.getByText("SIGN_AND_VERIFY"));

            await waitFor(() => {
                expect(screen.getByText("TRY_AGAIN")).toBeInTheDocument();
            });
        });
    });
});
