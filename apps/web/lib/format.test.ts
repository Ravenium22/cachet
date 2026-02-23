import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime, formatShortDate } from "./format";

describe("formatRelativeTime", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns 'just now' for times less than 60s ago", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-22T12:00:30Z"));
        expect(formatRelativeTime("2026-02-22T12:00:00Z")).toBe("just now");
    });

    it("returns minutes for times < 1h ago", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-22T12:15:00Z"));
        expect(formatRelativeTime("2026-02-22T12:00:00Z")).toBe("15m ago");
    });

    it("returns hours for times < 24h ago", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-22T15:00:00Z"));
        expect(formatRelativeTime("2026-02-22T12:00:00Z")).toBe("3h ago");
    });

    it("returns days for times < 30d ago", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-22T12:00:00Z"));
        expect(formatRelativeTime("2026-02-17T12:00:00Z")).toBe("5d ago");
    });

    it("returns short date for times >= 30d ago", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-22T12:00:00Z"));
        const result = formatRelativeTime("2026-01-01T12:00:00Z");
        expect(result).toContain("Jan");
        expect(result).toContain("2026");
    });

    it("returns 'just now' for future dates", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-22T12:00:00Z"));
        expect(formatRelativeTime("2026-02-22T13:00:00Z")).toBe("just now");
    });
});

describe("formatShortDate", () => {
    it("formats a date string", () => {
        const result = formatShortDate("2026-02-22T00:00:00Z");
        expect(result).toContain("Feb");
        expect(result).toContain("2026");
    });

    it("formats a Date object", () => {
        const result = formatShortDate(new Date("2026-01-15T00:00:00Z"));
        expect(result).toContain("Jan");
        expect(result).toContain("15");
    });
});
