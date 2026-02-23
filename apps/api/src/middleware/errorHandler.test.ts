import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

const { AppError, errorHandler } = await import("../middleware/errorHandler.js");

function mockReq(overrides: Partial<Request & { id?: string }> = {}): Request {
    return { id: "test-correlation-id", ...overrides } as unknown as Request;
}

function mockRes(): Response & { statusCode?: number; body?: unknown } {
    const res: Record<string, unknown> = {};
    res.statusCode = 200;
    res.body = null;
    res.status = vi.fn((code: number) => {
        res.statusCode = code;
        return res;
    });
    res.json = vi.fn((data: unknown) => {
        res.body = data;
        return res;
    });
    return res as unknown as Response & { statusCode?: number; body?: unknown };
}

const next: NextFunction = vi.fn();

describe("AppError", () => {
    it("creates an error with statusCode, message, and details", () => {
        const err = new AppError(422, "Validation failed", { field: "email" });
        expect(err).toBeInstanceOf(Error);
        expect(err.statusCode).toBe(422);
        expect(err.message).toBe("Validation failed");
        expect(err.details).toEqual({ field: "email" });
        expect(err.name).toBe("AppError");
    });
});

describe("errorHandler", () => {
    it("returns 400 for ZodError", async () => {
        const { ZodError } = await import("zod");
        const zodErr = new ZodError([
            {
                code: "invalid_type",
                expected: "string",
                received: "number",
                path: ["name"],
                message: "Expected string, received number",
            },
        ]);

        const res = mockRes();
        errorHandler(zodErr, mockReq(), res as unknown as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect((res.body as { error: string }).error).toBe("Validation error");
        expect((res.body as { details: unknown[] }).details).toHaveLength(1);
    });

    it("returns the correct status for AppError", () => {
        const err = new AppError(403, "Forbidden");
        const res = mockRes();
        errorHandler(err, mockReq(), res as unknown as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect((res.body as { error: string }).error).toBe("Forbidden");
        expect((res.body as { success: boolean }).success).toBe(false);
    });

    it("returns 503 for transient dependency errors", () => {
        const err = new Error("ECONNREFUSED: connection refused to redis");
        const res = mockRes();
        errorHandler(err, mockReq(), res as unknown as Response, next);

        expect(res.status).toHaveBeenCalledWith(503);
        expect((res.body as { error: string }).error).toBe("Service temporarily unavailable");
    });

    it("returns 500 for unknown errors", () => {
        const err = new Error("Something totally unexpected");
        const res = mockRes();
        errorHandler(err, mockReq(), res as unknown as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect((res.body as { error: string }).error).toBe("Internal server error");
    });

    it("includes correlationId in all responses", () => {
        const err = new AppError(404, "Not found");
        const res = mockRes();
        errorHandler(err, mockReq({ id: "abc-123" } as Partial<Request & { id?: string }>), res as unknown as Response, next);

        expect((res.body as { correlationId: string }).correlationId).toBe("abc-123");
    });

    it("returns 502 for PaddleCheckoutError", async () => {
        const { PaddleCheckoutError } = await import("../services/paddle.js");
        const err = new PaddleCheckoutError(
            "transaction_default_checkout_url_not_set",
            "A Default Payment Link has not yet been defined",
        );
        const res = mockRes();
        errorHandler(err, mockReq(), res as unknown as Response, next);

        expect(res.status).toHaveBeenCalledWith(502);
        expect((res.body as { error: string }).error).toBe("Payment provider error");
        expect((res.body as { code: string }).code).toBe("transaction_default_checkout_url_not_set");
        expect((res.body as { detail: string }).detail).toBe("A Default Payment Link has not yet been defined");
    });
});
