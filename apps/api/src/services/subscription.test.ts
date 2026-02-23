import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRow = {
  id: "sub-uuid-1",
  projectId: "project-uuid-1",
  tier: "free" as const,
  status: "active" as const,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: new Date("2100-01-01"),
  verificationCount: 0,
};

const mockFindFirst = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateReturning = vi.fn();
const mockSelectWhere = vi.fn();

vi.mock("@megaeth-verify/db", () => ({
  getDb: () => ({
    query: {
      subscriptions: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
      verifications: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: (...args: unknown[]) => mockSelectWhere(...args),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: (...args: unknown[]) => mockInsertReturning(...args),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: (...args: unknown[]) => mockUpdateReturning(...args),
        }),
      }),
    }),
  }),
  subscriptions: {
    id: "id",
    projectId: "projectId",
    tier: "tier",
    status: "status",
    stripeCustomerId: "stripeCustomerId",
    stripeSubscriptionId: "stripeSubscriptionId",
  },
  verifications: { id: "id", projectId: "projectId", userDiscordId: "userDiscordId", status: "status" },
  verificationLogs: { id: "id", verificationId: "verificationId", eventType: "eventType", createdAt: "createdAt", details: "details" },
  contracts: { id: "id", projectId: "projectId" },
  roleMappings: { id: "id", projectId: "projectId" },
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  count: vi.fn(),
  gte: vi.fn(),
  sql: vi.fn(),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Subscription Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockInsertReturning.mockResolvedValue([{ ...mockRow }]);
    mockUpdateReturning.mockResolvedValue([{ ...mockRow }]);
    mockSelectWhere.mockResolvedValue([{ total: 0 }]);
  });

  describe("ensureProjectSubscription", () => {
    it("creates a new free subscription when none exists", async () => {
      mockFindFirst.mockResolvedValue(null);

      const { ensureProjectSubscription } = await import("./subscription.js");
      const sub = await ensureProjectSubscription("project-uuid-1");

      expect(sub).toBeDefined();
      expect(mockInsertReturning).toHaveBeenCalled();
    });

    it("returns existing subscription when one exists", async () => {
      mockFindFirst.mockResolvedValue({ ...mockRow });

      const { ensureProjectSubscription } = await import("./subscription.js");
      const sub = await ensureProjectSubscription("project-uuid-1");

      expect(sub).toEqual(mockRow);
      expect(mockInsertReturning).not.toHaveBeenCalled();
    });

    it("downgrades past_due subscription when grace period has expired", async () => {
      const expiredSub = {
        ...mockRow,
        status: "past_due" as const,
        currentPeriodEnd: new Date("2020-01-01"), // In the past
      };
      mockFindFirst.mockResolvedValue(expiredSub);
      mockUpdateReturning.mockResolvedValue([{
        ...expiredSub,
        tier: "free",
        status: "cancelled",
      }]);

      const { ensureProjectSubscription } = await import("./subscription.js");
      const sub = await ensureProjectSubscription("project-uuid-1");

      expect(sub.tier).toBe("free");
      expect(sub.status).toBe("cancelled");
    });

    it("preserves tier for past_due within grace period", async () => {
      const pastDueSub = {
        ...mockRow,
        tier: "growth" as const,
        status: "past_due" as const,
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in the future
      };
      mockFindFirst.mockResolvedValue(pastDueSub);

      const { ensureProjectSubscription } = await import("./subscription.js");
      const sub = await ensureProjectSubscription("project-uuid-1");

      expect(sub.tier).toBe("growth");
      expect(sub.status).toBe("past_due");
    });
  });

  describe("getEffectiveSubscription", () => {
    it("returns the actual tier for an active subscription", async () => {
      const activeSub = { ...mockRow, tier: "pro" as const, status: "active" as const };
      mockFindFirst.mockResolvedValue(activeSub);

      const { getEffectiveSubscription } = await import("./subscription.js");
      const result = await getEffectiveSubscription("project-uuid-1");

      expect(result.effectiveTier).toBe("pro");
      expect(result.inGracePeriod).toBe(false);
    });

    it("returns grace period info for past_due within grace", async () => {
      const pastDueSub = {
        ...mockRow,
        tier: "growth" as const,
        status: "past_due" as const,
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockFindFirst.mockResolvedValue(pastDueSub);

      const { getEffectiveSubscription } = await import("./subscription.js");
      const result = await getEffectiveSubscription("project-uuid-1");

      expect(result.effectiveTier).toBe("growth");
      expect(result.inGracePeriod).toBe(true);
    });

    it("returns free tier for expired past_due subscription", async () => {
      const expiredSub = {
        ...mockRow,
        tier: "growth" as const,
        status: "past_due" as const,
        currentPeriodEnd: new Date("2020-01-01"), // Expired
      };
      mockFindFirst.mockResolvedValue(expiredSub);
      mockUpdateReturning.mockResolvedValue([{
        ...expiredSub,
        tier: "free",
        status: "cancelled",
      }]);

      const { getEffectiveSubscription } = await import("./subscription.js");
      const result = await getEffectiveSubscription("project-uuid-1");

      expect(result.effectiveTier).toBe("free");
      expect(result.inGracePeriod).toBe(false);
    });
  });

  describe("isWithinGracePeriod", () => {
    it("returns true for past_due with future end date", async () => {
      const { isWithinGracePeriod } = await import("./subscription.js");
      const sub = {
        ...mockRow,
        status: "past_due" as const,
        currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60),
      };
      expect(isWithinGracePeriod(sub)).toBe(true);
    });

    it("returns false for active subscription", async () => {
      const { isWithinGracePeriod } = await import("./subscription.js");
      const sub = {
        ...mockRow,
        status: "active" as const,
        currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60),
      };
      expect(isWithinGracePeriod(sub)).toBe(false);
    });

    it("returns false for expired past_due subscription", async () => {
      const { isWithinGracePeriod } = await import("./subscription.js");
      const sub = {
        ...mockRow,
        status: "past_due" as const,
        currentPeriodEnd: new Date("2020-01-01"),
      };
      expect(isWithinGracePeriod(sub)).toBe(false);
    });
  });

  describe("upsertProjectSubscription", () => {
    it("updates existing subscription", async () => {
      mockFindFirst.mockResolvedValue({ ...mockRow });
      const updatedRow = { ...mockRow, tier: "growth" as const };
      mockUpdateReturning.mockResolvedValue([updatedRow]);

      const { upsertProjectSubscription } = await import("./subscription.js");
      const result = await upsertProjectSubscription("project-uuid-1", {
        tier: "growth",
        status: "active",
        stripeCustomerId: "ctm_test",
        stripeSubscriptionId: "sub_test",
        currentPeriodEnd: new Date("2025-12-31"),
      });

      expect(result.tier).toBe("growth");
    });

    it("creates subscription when none exists", async () => {
      mockFindFirst.mockResolvedValue(null);
      const createdRow = { ...mockRow, tier: "pro" as const };
      mockInsertReturning.mockResolvedValue([createdRow]);

      const { upsertProjectSubscription } = await import("./subscription.js");
      const result = await upsertProjectSubscription("project-uuid-1", {
        tier: "pro",
        status: "active",
        currentPeriodEnd: new Date("2025-12-31"),
      });

      expect(result.tier).toBe("pro");
    });
  });

  describe("enforceContractLimit", () => {
    it("allows adding contracts within limit", async () => {
      const activeSub = { ...mockRow, tier: "free" as const, status: "active" as const };
      mockFindFirst.mockResolvedValue(activeSub);
      mockSelectWhere.mockResolvedValue([{ total: 0 }]); // 0 existing contracts

      const { enforceContractLimit } = await import("./subscription.js");
      await expect(enforceContractLimit("project-uuid-1")).resolves.toBeUndefined();
    });

    it("throws 402 when contract limit reached", async () => {
      const activeSub = { ...mockRow, tier: "free" as const, status: "active" as const };
      mockFindFirst.mockResolvedValue(activeSub);
      mockSelectWhere.mockResolvedValue([{ total: 1 }]); // 1 existing = limit for free

      const { enforceContractLimit } = await import("./subscription.js");
      await expect(enforceContractLimit("project-uuid-1")).rejects.toThrow(
        "Contract limit reached for your plan",
      );
    });
  });

  describe("enforceRoleMappingLimit", () => {
    it("allows adding role mappings within limit", async () => {
      const activeSub = { ...mockRow, tier: "free" as const, status: "active" as const };
      mockFindFirst.mockResolvedValue(activeSub);
      mockSelectWhere.mockResolvedValue([{ total: 0 }]);

      const { enforceRoleMappingLimit } = await import("./subscription.js");
      await expect(enforceRoleMappingLimit("project-uuid-1")).resolves.toBeUndefined();
    });

    it("throws 402 when role mapping limit reached for free tier", async () => {
      const activeSub = { ...mockRow, tier: "free" as const, status: "active" as const };
      mockFindFirst.mockResolvedValue(activeSub);
      mockSelectWhere.mockResolvedValue([{ total: 3 }]); // 3 = limit for free

      const { enforceRoleMappingLimit } = await import("./subscription.js");
      await expect(enforceRoleMappingLimit("project-uuid-1")).rejects.toThrow(
        "Role mapping limit reached for your plan",
      );
    });
  });

  describe("enforceMemberLimitForUser", () => {
    it("allows verification within member limit", async () => {
      const activeSub = { ...mockRow, tier: "free" as const, status: "active" as const };
      mockFindFirst.mockResolvedValue(activeSub); // For subscription lookup, NOT existing user
      mockSelectWhere.mockResolvedValue([{ total: 0 }]);

      const { enforceMemberLimitForUser } = await import("./subscription.js");
      // This will first check for existing verification (findFirst), then subscription
      // The mock returns activeSub for all findFirst calls
      await expect(
        enforceMemberLimitForUser("project-uuid-1", "discord-user-new"),
      ).resolves.toBeUndefined();
    });
  });
});
