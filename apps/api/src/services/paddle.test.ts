import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Paddle Service", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Set up ALL required env vars for the Paddle service
    process.env["PADDLE_API_KEY"] = "test_paddle_api_key";
    process.env["PADDLE_ENVIRONMENT"] = "sandbox";
    process.env["PADDLE_GROWTH_PRICE_ID"] = "pri_growth_test";
    process.env["PADDLE_PRO_PRICE_ID"] = "pri_pro_test";
    process.env["PADDLE_ENTERPRISE_PRICE_ID"] = "pri_enterprise_test";
    process.env["PADDLE_WEBHOOK_SECRET"] = "pdl_test_webhook_secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getPaddle", () => {
    it("throws when PADDLE_API_KEY is not set", async () => {
      delete process.env["PADDLE_API_KEY"];
      const { getPaddle } = await import("./paddle.js");
      expect(() => getPaddle()).toThrow("PADDLE_API_KEY environment variable is not set");
    });

    it("creates Paddle client when API key is set", async () => {
      const { getPaddle } = await import("./paddle.js");
      const client = getPaddle();
      expect(client).toBeDefined();
    });
  });

  describe("getPaddleWebhookSecret", () => {
    it("throws when PADDLE_WEBHOOK_SECRET is not set", async () => {
      delete process.env["PADDLE_WEBHOOK_SECRET"];
      const { getPaddleWebhookSecret } = await import("./paddle.js");
      expect(() => getPaddleWebhookSecret()).toThrow(
        "PADDLE_WEBHOOK_SECRET environment variable is not set",
      );
    });

    it("returns the webhook secret when set", async () => {
      const { getPaddleWebhookSecret } = await import("./paddle.js");
      expect(getPaddleWebhookSecret()).toBe("pdl_test_webhook_secret");
    });
  });

  describe("getPaddlePriceIdForTier", () => {
    it("returns the price ID for growth tier", async () => {
      const { getPaddlePriceIdForTier } = await import("./paddle.js");
      expect(getPaddlePriceIdForTier("growth")).toBe("pri_growth_test");
    });

    it("returns the price ID for pro tier", async () => {
      const { getPaddlePriceIdForTier } = await import("./paddle.js");
      expect(getPaddlePriceIdForTier("pro")).toBe("pri_pro_test");
    });

    it("returns the price ID for enterprise tier", async () => {
      const { getPaddlePriceIdForTier } = await import("./paddle.js");
      expect(getPaddlePriceIdForTier("enterprise")).toBe("pri_enterprise_test");
    });

    it("throws PaddleCheckoutError when enterprise price ID is missing", async () => {
      delete process.env["PADDLE_ENTERPRISE_PRICE_ID"];
      const { getPaddlePriceIdForTier, PaddleCheckoutError } = await import("./paddle.js");
      expect(() => getPaddlePriceIdForTier("enterprise")).toThrow(PaddleCheckoutError);
    });

    it("throws PaddleCheckoutError when growth price ID is missing", async () => {
      delete process.env["PADDLE_GROWTH_PRICE_ID"];
      const { getPaddlePriceIdForTier, PaddleCheckoutError } = await import("./paddle.js");
      expect(() => getPaddlePriceIdForTier("growth")).toThrow(PaddleCheckoutError);
    });
  });

  describe("getTierFromPaddlePriceId", () => {
    it("returns growth for the mapped growth price ID", async () => {
      const { getTierFromPaddlePriceId } = await import("./paddle.js");
      expect(getTierFromPaddlePriceId("pri_growth_test")).toBe("growth");
    });

    it("returns pro for the mapped pro price ID", async () => {
      const { getTierFromPaddlePriceId } = await import("./paddle.js");
      expect(getTierFromPaddlePriceId("pri_pro_test")).toBe("pro");
    });

    it("returns enterprise for the mapped enterprise price ID", async () => {
      const { getTierFromPaddlePriceId } = await import("./paddle.js");
      expect(getTierFromPaddlePriceId("pri_enterprise_test")).toBe("enterprise");
    });

    it("returns null for an unknown price ID", async () => {
      const { getTierFromPaddlePriceId } = await import("./paddle.js");
      expect(getTierFromPaddlePriceId("pri_unknown_999")).toBeNull();
    });

    it("returns null for null/undefined", async () => {
      const { getTierFromPaddlePriceId } = await import("./paddle.js");
      expect(getTierFromPaddlePriceId(null)).toBeNull();
      expect(getTierFromPaddlePriceId(undefined)).toBeNull();
    });
  });

  describe("getPaddleSubscriptionManagementUrls", () => {
    it("extracts management URLs from subscription", async () => {
      const { getPaddleSubscriptionManagementUrls } = await import("./paddle.js");
      const mockSubscription = {
        managementUrls: {
          updatePaymentMethod: "https://paddle.com/update",
          cancel: "https://paddle.com/cancel",
        },
      } as Awaited<ReturnType<typeof import("./paddle.js")["getPaddleSubscription"]>>;

      const urls = getPaddleSubscriptionManagementUrls(mockSubscription);
      expect(urls.updatePaymentMethod).toBe("https://paddle.com/update");
      expect(urls.cancel).toBe("https://paddle.com/cancel");
    });

    it("returns nulls when managementUrls is missing", async () => {
      const { getPaddleSubscriptionManagementUrls } = await import("./paddle.js");
      const mockSubscription = {
        managementUrls: undefined,
      } as Awaited<ReturnType<typeof import("./paddle.js")["getPaddleSubscription"]>>;

      const urls = getPaddleSubscriptionManagementUrls(mockSubscription);
      expect(urls.updatePaymentMethod).toBeNull();
      expect(urls.cancel).toBeNull();
    });
  });
});
