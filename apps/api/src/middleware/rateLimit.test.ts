import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock Redis with eval that simulates sliding window
const mockEval = vi.fn();
vi.mock("../services/redis.js", () => ({
    getRedis: () => ({
        eval: mockEval,
    }),
}));

// Mock subscription service
vi.mock("../services/subscription.js", () => ({
    getEffectiveSubscription: vi.fn().mockResolvedValue({ effectiveTier: "free" }),
}));

const { slidingWindowRateLimit } = await import("../middleware/rateLimit.js");

function mockReq(overrides: Partial<Request> = {}): Request {
    return {
        ip: "127.0.0.1",
        headers: {},
        user: { sub: "discord-123" },
        ...overrides,
    } as unknown as Request;
}

function mockRes(): Response {
    return {} as Response;
}

describe("slidingWindowRateLimit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls next() when under the rate limit", async () => {
        // Simulate allowed: [1 = allowed, currentCount, retryAfterMs]
        mockEval.mockResolvedValue([1, 1, 60000]);

        const middleware = slidingWindowRateLimit({
            scope: "test",
            windowSeconds: 60,
            maxRequests: 10,
            keyGenerator: (req) => req.ip ?? null,
        });

        const next: NextFunction = vi.fn();
        await middleware(mockReq(), mockRes(), next);

        expect(next).toHaveBeenCalledOnce();
        expect(next).toHaveBeenCalledWith(); // called with no error
    });

    it("throws 429 when rate limit is exceeded", async () => {
        // Simulate denied: [0 = denied, currentCount, retryAfterMs]
        mockEval.mockResolvedValue([0, 11, 30000]);

        const middleware = slidingWindowRateLimit({
            scope: "test",
            windowSeconds: 60,
            maxRequests: 10,
            keyGenerator: (req) => req.ip ?? null,
        });

        const next: NextFunction = vi.fn();
        await middleware(mockReq(), mockRes(), next);

        // Should call next with an error
        expect(next).toHaveBeenCalledOnce();
        const error = (next as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as { statusCode?: number; message?: string };
        expect(error).toBeDefined();
        expect(error.statusCode).toBe(429);
        expect(error.message).toContain("Too many requests");
    });

    it("allows request when keyGenerator returns null (skip rate limit)", async () => {
        const middleware = slidingWindowRateLimit({
            scope: "test",
            windowSeconds: 60,
            maxRequests: 10,
            keyGenerator: () => null, // no key = skip
        });

        const next: NextFunction = vi.fn();
        await middleware(mockReq(), mockRes(), next);

        expect(next).toHaveBeenCalledOnce();
        expect(mockEval).not.toHaveBeenCalled();
    });

    it("allows request gracefully when Redis is down", async () => {
        mockEval.mockRejectedValue(new Error("Redis connection timeout"));

        const middleware = slidingWindowRateLimit({
            scope: "test",
            windowSeconds: 60,
            maxRequests: 10,
            keyGenerator: (req) => req.ip ?? null,
        });

        const next: NextFunction = vi.fn();
        await middleware(mockReq(), mockRes(), next);

        // Should fail-open: allow the request
        expect(next).toHaveBeenCalledOnce();
        expect(next).toHaveBeenCalledWith(); // no error argument
    });

    it("supports dynamic maxRequests via async function", async () => {
        mockEval.mockResolvedValue([1, 1, 60000]);

        const dynamicMax = vi.fn().mockResolvedValue(50);

        const middleware = slidingWindowRateLimit({
            scope: "test",
            windowSeconds: 60,
            maxRequests: dynamicMax,
            keyGenerator: (req) => req.ip ?? null,
        });

        const next: NextFunction = vi.fn();
        await middleware(mockReq(), mockRes(), next);

        expect(dynamicMax).toHaveBeenCalledOnce();
        expect(next).toHaveBeenCalledOnce();
        // Verify 50 was passed to Redis eval
        expect(mockEval).toHaveBeenCalledWith(
            expect.any(String), // lua script
            1,
            expect.any(String), // key
            expect.any(String), // nowMs
            expect.any(String), // windowMs
            "50", // maxRequests
            expect.any(String), // nonce
        );
    });

    it("calls onLimitExceeded callback when rate limit is hit", async () => {
        mockEval.mockResolvedValue([0, 11, 30000]);

        const onLimitExceeded = vi.fn();

        const middleware = slidingWindowRateLimit({
            scope: "test",
            windowSeconds: 60,
            maxRequests: 10,
            keyGenerator: (req) => req.ip ?? null,
            onLimitExceeded,
        });

        const next: NextFunction = vi.fn();
        await middleware(mockReq(), mockRes(), next);

        expect(onLimitExceeded).toHaveBeenCalledOnce();
    });
});
