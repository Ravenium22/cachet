import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis before importing the module
vi.mock("../services/redis.js", () => ({
    getRedis: () => ({
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockResolvedValue(["discord-user-123"]),
    }),
}));

// Set env vars before importing
process.env["JWT_SECRET"] = "test-jwt-secret-for-testing-only-64chars-padded-00000000000000000";
process.env["JWT_REFRESH_SECRET"] = "test-refresh-secret-for-testing-only-64chars-padded-0000000000";

const jwt = await import("jsonwebtoken");

describe("JWT Service", () => {
    // We test the generateTokens output format and consumeRefreshToken logic
    // without hitting Redis by mocking it

    it("generates valid access and refresh token pair", async () => {
        const { generateTokens } = await import("../services/jwt.js");
        const tokens = await generateTokens("discord-123", "testuser");

        expect(tokens).toHaveProperty("accessToken");
        expect(tokens).toHaveProperty("refreshToken");
        expect(typeof tokens.accessToken).toBe("string");
        expect(typeof tokens.refreshToken).toBe("string");

        // Decode access token
        const accessPayload = jwt.default.decode(tokens.accessToken) as Record<string, unknown>;
        expect(accessPayload.sub).toBe("discord-123");
        expect(accessPayload.username).toBe("testuser");
        expect(accessPayload.type).toBe("access");
        expect(accessPayload.exp).toBeDefined();

        // Decode refresh token
        const refreshPayload = jwt.default.decode(tokens.refreshToken) as Record<string, unknown>;
        expect(refreshPayload.sub).toBe("discord-123");
        expect(refreshPayload.type).toBe("refresh");
        expect(refreshPayload.jti).toBeDefined();
    });

    it("access token is verifiable with JWT_SECRET", async () => {
        const { generateTokens } = await import("../services/jwt.js");
        const tokens = await generateTokens("discord-456", "anotheruser");

        const verified = jwt.default.verify(
            tokens.accessToken,
            process.env["JWT_SECRET"]!,
        ) as Record<string, unknown>;
        expect(verified.sub).toBe("discord-456");
        expect(verified.type).toBe("access");
    });

    it("refresh token is verifiable with JWT_REFRESH_SECRET", async () => {
        const { generateTokens } = await import("../services/jwt.js");
        const tokens = await generateTokens("discord-789", "thirduser");

        const verified = jwt.default.verify(
            tokens.refreshToken,
            process.env["JWT_REFRESH_SECRET"]!,
        ) as Record<string, unknown>;
        expect(verified.sub).toBe("discord-789");
        expect(verified.type).toBe("refresh");
    });

    it("access token cannot be verified with refresh secret", async () => {
        const { generateTokens } = await import("../services/jwt.js");
        const tokens = await generateTokens("discord-111", "wrongsecret");

        expect(() =>
            jwt.default.verify(tokens.accessToken, process.env["JWT_REFRESH_SECRET"]!),
        ).toThrow();
    });
});
