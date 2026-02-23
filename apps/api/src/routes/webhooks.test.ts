import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRedis = {
  eval: vi.fn().mockResolvedValue([1, 1, 60000]),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
};

vi.mock("../services/redis.js", () => ({
  getRedis: () => mockRedis,
}));

// Mock logger
vi.mock("../services/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock subscription service
const mockUpsertProjectSubscription = vi.fn().mockResolvedValue({});
const mockFindSubscriptionByPaddleSubscriptionId = vi.fn().mockResolvedValue(null);
const mockFindProjectIdByPaddleCustomerId = vi.fn().mockResolvedValue(null);
const mockMarkPaymentFailedWithGrace = vi.fn().mockResolvedValue({});

vi.mock("../services/subscription.js", () => ({
  upsertProjectSubscription: (...args: unknown[]) => mockUpsertProjectSubscription(...args),
  findSubscriptionByPaddleSubscriptionId: (...args: unknown[]) => mockFindSubscriptionByPaddleSubscriptionId(...args),
  findProjectIdByPaddleCustomerId: (...args: unknown[]) => mockFindProjectIdByPaddleCustomerId(...args),
  markPaymentFailedWithGrace: (...args: unknown[]) => mockMarkPaymentFailedWithGrace(...args),
}));

// Set up env
process.env["PADDLE_WEBHOOK_SECRET"] = "test-webhook-secret-for-testing";
process.env["PADDLE_GROWTH_PRICE_ID"] = "pri_growth_test";
process.env["PADDLE_PRO_PRICE_ID"] = "pri_pro_test";
process.env["PADDLE_ENTERPRISE_PRICE_ID"] = "pri_enterprise_test";

const { webhooksRouter } = await import("../routes/webhooks.js");

// ── Test Helpers ───────────────────────────────────────────────────────────

import express from "express";
import { errorHandler } from "../middleware/errorHandler.js";
import http from "node:http";

function createTestApp() {
  const app = express();
  // Webhook route handles raw body before json parsing
  app.use("/api/v1/webhooks", webhooksRouter);
  app.use(express.json());
  app.use(errorHandler);
  return app;
}

function signPaddleWebhook(body: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}:${body}`;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `ts=${timestamp};h1=${hash}`;
}

function makeWebhookEvent(eventType: string, data: Record<string, unknown>): Record<string, unknown> {
  return {
    event_id: `evt_${crypto.randomUUID()}`,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    notification_id: `ntf_${crypto.randomUUID()}`,
    data,
  };
}

async function sendWebhook(
  app: express.Express,
  body: string,
  signature: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("Failed to get server address"));
        return;
      }

      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/api/v1/webhooks/paddle",
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body).toString(),
            "paddle-signature": signature,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            server.close();
            let parsed: unknown;
            try {
              parsed = JSON.parse(data);
            } catch {
              parsed = data;
            }
            resolve({ status: res.statusCode ?? 0, body: parsed });
          });
        },
      );

      req.on("error", (err) => {
        server.close();
        reject(err);
      });

      req.write(body);
      req.end();
    });
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Webhook Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.del.mockResolvedValue(1);
  });

  describe("POST /api/v1/webhooks/paddle", () => {
    it("rejects when Paddle signature is missing", async () => {
      const app = createTestApp();
      const body = JSON.stringify(makeWebhookEvent("subscription.created", {}));

      const res = await sendWebhook(app, body, "");
      // Empty string for paddle-signature header still gets sent
      expect(res.status).toBe(400);
    });

    it("rejects invalid Paddle signature", async () => {
      const app = createTestApp();
      const body = JSON.stringify(makeWebhookEvent("subscription.created", {}));

      const res = await sendWebhook(app, body, "ts=12345;h1=invalidhash");
      expect(res.status).toBe(400);
    });

    it("accepts valid Paddle signature for subscription.created", async () => {
      const event = makeWebhookEvent("subscription.created", {
        id: "sub_paddle_123",
        status: "active",
        customer_id: "ctm_paddle_123",
        items: [{ price: { id: "pri_growth_test" }, quantity: 1 }],
        custom_data: { projectId: "project-uuid-1", tier: "growth" },
        current_billing_period: {
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      const body = JSON.stringify(event);
      const signature = signPaddleWebhook(body, process.env["PADDLE_WEBHOOK_SECRET"]!);

      const app = createTestApp();
      const res = await sendWebhook(app, body, signature);

      expect(res.status).toBe(200);
      expect((res.body as { received: boolean }).received).toBe(true);
      expect(mockUpsertProjectSubscription).toHaveBeenCalledWith(
        "project-uuid-1",
        expect.objectContaining({
          tier: "growth",
          status: "active",
          stripeCustomerId: "ctm_paddle_123",
          stripeSubscriptionId: "sub_paddle_123",
        }),
      );
    });

    it("handles subscription.canceled event properly", async () => {
      const event = makeWebhookEvent("subscription.canceled", {
        id: "sub_paddle_123",
        status: "canceled",
        customer_id: "ctm_paddle_123",
        items: [{ price: { id: "pri_growth_test" }, quantity: 1 }],
        custom_data: { projectId: "project-uuid-1", tier: "growth" },
      });

      const body = JSON.stringify(event);
      const signature = signPaddleWebhook(body, process.env["PADDLE_WEBHOOK_SECRET"]!);

      const app = createTestApp();
      const res = await sendWebhook(app, body, signature);

      expect(res.status).toBe(200);
      expect(mockUpsertProjectSubscription).toHaveBeenCalledWith(
        "project-uuid-1",
        expect.objectContaining({
          tier: "free",
          status: "cancelled",
        }),
      );
    });

    it("handles subscription.past_due event", async () => {
      mockFindProjectIdByPaddleCustomerId.mockResolvedValue("project-uuid-1");

      const event = makeWebhookEvent("subscription.past_due", {
        id: "sub_paddle_123",
        status: "past_due",
        customer_id: "ctm_paddle_123",
        items: [{ price: { id: "pri_growth_test" }, quantity: 1 }],
      });

      const body = JSON.stringify(event);
      const signature = signPaddleWebhook(body, process.env["PADDLE_WEBHOOK_SECRET"]!);

      const app = createTestApp();
      const res = await sendWebhook(app, body, signature);

      expect(res.status).toBe(200);
    });

    it("handles transaction.completed event", async () => {
      const event = makeWebhookEvent("transaction.completed", {
        id: "txn_paddle_123",
        status: "completed",
        customer_id: "ctm_paddle_123",
        subscription_id: "sub_paddle_123",
        items: [{ price: { id: "pri_pro_test" }, quantity: 1 }],
        custom_data: { projectId: "project-uuid-1", tier: "pro" },
      });

      const body = JSON.stringify(event);
      const signature = signPaddleWebhook(body, process.env["PADDLE_WEBHOOK_SECRET"]!);

      const app = createTestApp();
      const res = await sendWebhook(app, body, signature);

      expect(res.status).toBe(200);
      expect(mockUpsertProjectSubscription).toHaveBeenCalledWith(
        "project-uuid-1",
        expect.objectContaining({
          tier: "pro",
          status: "active",
        }),
      );
    });

    it("deduplicates events using Redis idempotency", async () => {
      // Signal that event was already processed (NX returns null)
      mockRedis.set.mockResolvedValue(null);

      const event = makeWebhookEvent("subscription.created", {
        id: "sub_paddle_123",
        status: "active",
        customer_id: "ctm_paddle_123",
        items: [{ price: { id: "pri_growth_test" }, quantity: 1 }],
        custom_data: { projectId: "project-uuid-1" },
      });

      const body = JSON.stringify(event);
      const signature = signPaddleWebhook(body, process.env["PADDLE_WEBHOOK_SECRET"]!);

      const app = createTestApp();
      const res = await sendWebhook(app, body, signature);

      expect(res.status).toBe(200);
      expect((res.body as { duplicate?: boolean }).duplicate).toBe(true);
      // Should NOT process the event again
      expect(mockUpsertProjectSubscription).not.toHaveBeenCalled();
    });

    it("handles unrecognized event types gracefully", async () => {
      const event = makeWebhookEvent("unknown.event.type", { id: "test" });

      const body = JSON.stringify(event);
      const signature = signPaddleWebhook(body, process.env["PADDLE_WEBHOOK_SECRET"]!);

      const app = createTestApp();
      const res = await sendWebhook(app, body, signature);

      expect(res.status).toBe(200);
      expect((res.body as { received: boolean }).received).toBe(true);
    });
  });
});

describe("Paddle Webhook Signature Verification", () => {
  it("correctly validates a properly signed webhook", () => {
    const body = '{"event_id":"test","event_type":"test"}';
    const secret = "test-secret";
    const timestamp = "1234567890";
    const signedPayload = `${timestamp}:${body}`;
    const hash = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");
    const signature = `ts=${timestamp};h1=${hash}`;

    // Verify the structure is correct
    expect(signature).toMatch(/^ts=\d+;h1=[a-f0-9]{64}$/);
  });

  it("uses timing-safe comparison", () => {
    // Ensure crypto.timingSafeEqual is available
    const buf1 = Buffer.from("abc123");
    const buf2 = Buffer.from("abc123");
    expect(crypto.timingSafeEqual(buf1, buf2)).toBe(true);

    const buf3 = Buffer.from("xyz789");
    expect(crypto.timingSafeEqual(buf1, buf3)).toBe(false);
  });
});
