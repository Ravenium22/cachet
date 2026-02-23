import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock Redis
const mockRedisEval = vi.fn().mockResolvedValue([1, 1, 60000]);
vi.mock("../services/redis.js", () => ({
  getRedis: () => ({
    eval: mockRedisEval,
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  }),
}));

// Mock database
const VALID_PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const VALID_SUB_ID = "b1ffcd00-0d1c-5fg9-cc7e-7ccace491b22";

const mockSubscription = {
  id: VALID_SUB_ID,
  projectId: VALID_PROJECT_ID,
  tier: "free",
  status: "active",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: new Date("2100-01-01"),
  verificationCount: 0,
};

const mockProject = {
  id: VALID_PROJECT_ID,
  name: "Test Project",
  discordGuildId: "123456789012345678",
  ownerDiscordId: "discord-user-1",
  verificationChannelId: null,
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

vi.mock("@megaeth-verify/db", () => ({
  getDb: () => ({
    query: {
      projects: {
        findFirst: vi.fn().mockResolvedValue(mockProject),
        findMany: vi.fn().mockResolvedValue([mockProject]),
      },
      subscriptions: {
        findFirst: vi.fn().mockResolvedValue(mockSubscription),
      },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ total: 0 }]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockSubscription]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSubscription]),
        }),
      }),
    }),
  }),
  projects: { id: "id", ownerDiscordId: "ownerDiscordId", deletedAt: "deletedAt", discordGuildId: "discordGuildId" },
  subscriptions: { id: "id", projectId: "projectId", stripeCustomerId: "stripeCustomerId", stripeSubscriptionId: "stripeSubscriptionId" },
  contracts: { id: "id", projectId: "projectId" },
  roleMappings: { id: "id", projectId: "projectId" },
  verifications: { id: "id", projectId: "projectId", userDiscordId: "userDiscordId", status: "status" },
  verificationLogs: { id: "id", verificationId: "verificationId", eventType: "eventType", createdAt: "createdAt", details: "details" },
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  count: vi.fn(),
  gte: vi.fn(),
  sql: vi.fn(),
}));

// Mock Paddle service
const mockCreatePaddleCheckout = vi.fn().mockResolvedValue({
  transactionId: "txn_test_123",
  checkoutUrl: "https://checkout.paddle.com/test",
});
const mockCreatePaddleCustomer = vi.fn().mockResolvedValue("ctm_test_123");
const mockGetPaddleSubscription = vi.fn();
const mockGetPaddleSubscriptionManagementUrls = vi.fn().mockReturnValue({
  updatePaymentMethod: "https://paddle.com/update",
  cancel: "https://paddle.com/cancel",
});

vi.mock("../services/paddle.js", () => ({
  createPaddleCheckout: (...args: unknown[]) => mockCreatePaddleCheckout(...args),
  createPaddleCustomer: (...args: unknown[]) => mockCreatePaddleCustomer(...args),
  getPaddleSubscription: (...args: unknown[]) => mockGetPaddleSubscription(...args),
  getPaddleSubscriptionManagementUrls: (...args: unknown[]) => mockGetPaddleSubscriptionManagementUrls(...args),
  PaddleCheckoutError: class PaddleCheckoutError extends Error {
    code: string;
    detail: string;
    constructor(code: string, detail: string) {
      super(detail);
      this.name = "PaddleCheckoutError";
      this.code = code;
      this.detail = detail;
    }
  },
}));

// Mock subscription service
const mockEnsureProjectSubscription = vi.fn().mockResolvedValue(mockSubscription);
const mockGetEffectiveSubscription = vi.fn().mockResolvedValue({
  subscription: mockSubscription,
  effectiveTier: "free",
  inGracePeriod: false,
});
const mockUpsertProjectSubscription = vi.fn().mockResolvedValue(mockSubscription);

vi.mock("../services/subscription.js", () => ({
  ensureProjectSubscription: (...args: unknown[]) => mockEnsureProjectSubscription(...args),
  getEffectiveSubscription: (...args: unknown[]) => mockGetEffectiveSubscription(...args),
  upsertProjectSubscription: (...args: unknown[]) => mockUpsertProjectSubscription(...args),
}));

// Env setup
process.env["JWT_SECRET"] = "test-jwt-secret-for-billing-tests-64chars-padded-00000000000000";
process.env["FRONTEND_URL"] = "https://testapp.example.com";

const { billingRouter } = await import("../routes/billing.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAccessToken(sub: string = "discord-user-1", username: string = "testuser"): string {
  return jwt.sign({ sub, username, type: "access" }, process.env["JWT_SECRET"]!, { expiresIn: "15m" });
}

// Build a minimal Express-like handler test harness
import express from "express";
import { errorHandler } from "../middleware/errorHandler.js";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/billing", billingRouter);
  app.use(errorHandler);
  return app;
}

// Use supertest-like approach but manually
import http from "node:http";

function request(app: express.Express) {
  const server = http.createServer(app);

  return {
    get(path: string) {
      return new RequestBuilder(server, "GET", path);
    },
    post(path: string) {
      return new RequestBuilder(server, "POST", path);
    },
  };
}

class RequestBuilder {
  private _headers: Record<string, string> = {};
  private _body: unknown = null;

  constructor(
    private server: http.Server,
    private method: string,
    private path: string,
  ) {}

  set(header: string, value: string) {
    this._headers[header] = value;
    return this;
  }

  send(body: unknown) {
    this._body = body;
    return this;
  }

  async expect(status: number): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      this.server.listen(0, () => {
        const addr = this.server.address();
        if (!addr || typeof addr === "string") {
          this.server.close();
          reject(new Error("Failed to get server address"));
          return;
        }

        const bodyStr = this._body ? JSON.stringify(this._body) : undefined;
        if (bodyStr) {
          this._headers["content-type"] = "application/json";
          this._headers["content-length"] = Buffer.byteLength(bodyStr).toString();
        }

        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: addr.port,
            path: this.path,
            method: this.method,
            headers: this._headers,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              this.server.close();
              let body: unknown;
              try {
                body = JSON.parse(data);
              } catch {
                body = data;
              }
              if (res.statusCode === status) {
                resolve({ status: res.statusCode ?? 0, body });
              } else {
                reject(
                  new Error(
                    `Expected status ${status}, got ${res.statusCode}: ${JSON.stringify(body)}`,
                  ),
                );
              }
            });
          },
        );

        req.on("error", (err) => {
          this.server.close();
          reject(err);
        });

        if (bodyStr) {
          req.write(bodyStr);
        }

        req.end();
      });
    });
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Billing Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisEval.mockResolvedValue([1, 1, 60000]); // Rate limit: allow
    mockEnsureProjectSubscription.mockResolvedValue(mockSubscription);
    mockCreatePaddleCheckout.mockResolvedValue({
      transactionId: "txn_test_123",
      checkoutUrl: "https://checkout.paddle.com/test",
    });
    mockCreatePaddleCustomer.mockResolvedValue("ctm_test_123");
  });

  describe("GET /api/v1/billing/plans", () => {
    it("returns all billing plans with limits", async () => {
      const app = createTestApp();
      const res = await request(app).get("/api/v1/billing/plans").expect(200);

      const body = res.body as { success: boolean; data: Array<{ tier: string; limits: Record<string, unknown> }> };
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(4);
      expect(body.data.map((p) => p.tier)).toEqual(["free", "growth", "pro", "enterprise"]);

      // Free tier should have finite limits
      const freePlan = body.data.find((p) => p.tier === "free")!;
      expect(freePlan.limits.maxVerifiedMembers).toBe(100);
      expect(freePlan.limits.maxServers).toBe(1);
      expect(freePlan.limits.maxContracts).toBe(1);
      expect(freePlan.limits.maxRoleMappings).toBe(3);
      expect(freePlan.limits.maxAdminChecksPerMonth).toBe(0);

      // Enterprise should have null (Infinity) limits
      const entPlan = body.data.find((p) => p.tier === "enterprise")!;
      expect(entPlan.limits.maxVerifiedMembers).toBeNull();
      expect(entPlan.limits.maxServers).toBeNull();
      expect(entPlan.limits.maxContracts).toBeNull();
    });
  });

  describe("GET /api/v1/billing/subscription", () => {
    it("returns 401 without auth", async () => {
      const app = createTestApp();
      const res = await request(app)
        .get(`/api/v1/billing/subscription?projectId=${VALID_PROJECT_ID}`)
        .expect(401);

      expect((res.body as { success: boolean }).success).toBe(false);
    });

    it("returns subscription data for authenticated user", async () => {
      mockGetEffectiveSubscription.mockResolvedValue({
        subscription: { ...mockSubscription, status: "active" },
        effectiveTier: "free",
        inGracePeriod: false,
      });

      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .get(`/api/v1/billing/subscription?projectId=${VALID_PROJECT_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const body = res.body as { success: boolean; data: { tier: string; status: string; inGracePeriod: boolean } };
      expect(body.success).toBe(true);
      expect(body.data.tier).toBe("free");
      expect(body.data.status).toBe("active");
      expect(body.data.inGracePeriod).toBe(false);
    });

    it("returns 400 for invalid projectId format", async () => {
      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .get("/api/v1/billing/subscription?projectId=not-a-uuid")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect((res.body as { error: string }).error).toBe("Validation error");
    });
  });

  describe("POST /api/v1/billing/checkout", () => {
    it("returns 401 without auth", async () => {
      const app = createTestApp();
      const res = await request(app)
        .post("/api/v1/billing/checkout")
        .send({ projectId: VALID_PROJECT_ID, tier: "growth" })
        .expect(401);

      expect((res.body as { success: boolean }).success).toBe(false);
    });

    it("creates checkout for growth tier", async () => {
      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "growth" })
        .expect(200);

      const body = res.body as { success: boolean; data: { id: string; url: string } };
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("txn_test_123");
      expect(body.data.url).toBe("https://checkout.paddle.com/test");
    });

    it("creates checkout for pro tier", async () => {
      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "pro" })
        .expect(200);

      const body = res.body as { success: boolean; data: { id: string; url: string } };
      expect(body.success).toBe(true);
    });

    it("rejects enterprise tier (contact-us only)", async () => {
      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "enterprise" })
        .expect(400);

      expect((res.body as { error: string }).error).toBe("Validation error");
    });

    it("returns 400 for invalid tier", async () => {
      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "invalid-tier" })
        .expect(400);

      expect((res.body as { error: string }).error).toBe("Validation error");
    });

    it("returns 400 for free tier (not in allowed checkout tiers)", async () => {
      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "free" })
        .expect(400);

      expect((res.body as { error: string }).error).toBe("Validation error");
    });

    it("returns 400 when projectId is missing", async () => {
      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ tier: "growth" })
        .expect(400);

      expect((res.body as { error: string }).error).toBe("Validation error");
    });

    it("creates Paddle customer when subscription has no existing customer ID", async () => {
      mockEnsureProjectSubscription.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: null,
      });

      const app = createTestApp();
      const token = makeAccessToken();
      await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "growth" })
        .expect(200);

      expect(mockCreatePaddleCustomer).toHaveBeenCalledWith(
        VALID_PROJECT_ID,
        "Test Project",
      );
      expect(mockUpsertProjectSubscription).toHaveBeenCalled();
    });

    it("reuses existing Paddle customer ID when available", async () => {
      mockEnsureProjectSubscription.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: "ctm_existing_123",
      });

      const app = createTestApp();
      const token = makeAccessToken();
      await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "growth" })
        .expect(200);

      // Should NOT create a new customer
      expect(mockCreatePaddleCustomer).not.toHaveBeenCalled();
    });

    it("returns 500 when Paddle checkout creation fails", async () => {
      mockCreatePaddleCheckout.mockRejectedValue(new Error("Paddle API error"));

      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "growth" })
        .expect(500);

      expect((res.body as { success: boolean }).success).toBe(false);
    });

    it("returns 502 when Paddle returns a checkout config error (PaddleCheckoutError)", async () => {
      const { PaddleCheckoutError } = await import("../services/paddle.js");
      mockCreatePaddleCheckout.mockRejectedValue(
        new PaddleCheckoutError(
          "transaction_default_checkout_url_not_set",
          "A Default Payment Link has not yet been defined within the Paddle Dashboard",
        ),
      );

      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "growth" })
        .expect(502);

      const body = res.body as { success: boolean; error: string; code: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe("Payment provider error");
      expect(body.code).toBe("transaction_default_checkout_url_not_set");
    });

    it("passes correct success URL using FRONTEND_URL", async () => {
      const app = createTestApp();
      const token = makeAccessToken();
      await request(app)
        .post("/api/v1/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID, tier: "growth" })
        .expect(200);

      expect(mockCreatePaddleCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          successUrl: `https://testapp.example.com/dashboard/${VALID_PROJECT_ID}/settings?billing=success`,
        }),
      );
    });
  });

  describe("POST /api/v1/billing/portal", () => {
    it("returns 401 without auth", async () => {
      const app = createTestApp();
      const res = await request(app)
        .post("/api/v1/billing/portal")
        .send({ projectId: VALID_PROJECT_ID })
        .expect(401);

      expect((res.body as { success: boolean }).success).toBe(false);
    });

    it("returns portal URLs for a project with an active subscription", async () => {
      mockEnsureProjectSubscription.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: "sub_paddle_123",
      });
      mockGetPaddleSubscription.mockResolvedValue({
        id: "sub_paddle_123",
        managementUrls: {
          updatePaymentMethod: "https://paddle.com/update",
          cancel: "https://paddle.com/cancel",
        },
      });

      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/portal")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID })
        .expect(200);

      const body = res.body as { success: boolean; data: { cancelUrl: string; updatePaymentUrl: string } };
      expect(body.success).toBe(true);
      expect(body.data.cancelUrl).toBe("https://paddle.com/cancel");
      expect(body.data.updatePaymentUrl).toBe("https://paddle.com/update");
    });

    it("returns 400 when no subscription exists", async () => {
      mockEnsureProjectSubscription.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
      });

      const app = createTestApp();
      const token = makeAccessToken();
      const res = await request(app)
        .post("/api/v1/billing/portal")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectId: VALID_PROJECT_ID })
        .expect(400);

      expect((res.body as { error: string }).error).toBe(
        "No active subscription found for this project.",
      );
    });
  });
});
