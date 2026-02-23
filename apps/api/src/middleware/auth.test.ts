import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Set env before importing module
process.env["JWT_SECRET"] = "test-secret-key-for-unit-tests-only";

// Dynamic import to pick up the env
const { requireAuth } = await import("../middleware/auth.js");
const { AppError } = await import("../middleware/errorHandler.js");

function mockReq(overrides: Partial<Request> = {}): Request {
    return {
        headers: {},
        ...overrides,
    } as Request;
}

function mockRes(): Response {
    return {} as Response;
}

describe("requireAuth middleware", () => {
    const next: NextFunction = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws 401 when Authorization header is missing", () => {
        const req = mockReq();
        expect(() => requireAuth(req, mockRes(), next)).toThrow(AppError);
        expect(() => requireAuth(req, mockRes(), next)).toThrow(
            "Missing or invalid authorization header",
        );
    });

    it("throws 401 when Authorization header does not start with Bearer", () => {
        const req = mockReq({ headers: { authorization: "Basic abc123" } });
        expect(() => requireAuth(req, mockRes(), next)).toThrow(AppError);
    });

    it("throws 401 for an invalid JWT token", () => {
        const req = mockReq({ headers: { authorization: "Bearer invalid.token.here" } });
        expect(() => requireAuth(req, mockRes(), next)).toThrow(
            "Invalid or expired access token",
        );
    });

    it("throws 401 when token type is not 'access'", () => {
        const token = jwt.sign({ sub: "123", type: "refresh" }, "test-secret-key-for-unit-tests-only");
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        expect(() => requireAuth(req, mockRes(), next)).toThrow("Invalid token type");
    });

    it("sets req.user and calls next() for a valid access token", () => {
        const payload = { sub: "discord-user-123", username: "testuser", type: "access" as const };
        const token = jwt.sign(payload, "test-secret-key-for-unit-tests-only", { expiresIn: "15m" });
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });

        requireAuth(req, mockRes(), next);

        expect(next).toHaveBeenCalledOnce();
        expect(req.user).toBeDefined();
        expect(req.user?.sub).toBe("discord-user-123");
        expect(req.user?.username).toBe("testuser");
        expect(req.user?.type).toBe("access");
    });

    it("throws 401 for an expired token", () => {
        const token = jwt.sign(
            { sub: "123", type: "access" },
            "test-secret-key-for-unit-tests-only",
            { expiresIn: "0s" },
        );
        // Small delay to ensure expiry
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        expect(() => requireAuth(req, mockRes(), next)).toThrow(
            "Invalid or expired access token",
        );
    });
});
