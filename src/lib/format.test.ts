import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatRelativeTime,
  toDateInputValue,
} from "./format";

describe("formatDate", () => {
  it("renders a friendly day/month/year for a Date instance", () => {
    expect(formatDate(new Date("2026-08-20T00:00:00.000Z"))).toBe("20 Aug 2026");
  });

  it("renders a friendly day/month/year for a date string", () => {
    expect(formatDate("2026-01-05")).toBe("5 Jan 2026");
  });

  it("uses UTC so a UTC-midnight date never shifts a day earlier/later", () => {
    // The DB stores plain dates as UTC midnight; formatting must read the
    // same UTC fields toDateInputValue does, not local-timezone getters,
    // or the displayed day could drift depending on server TZ.
    expect(formatDate(new Date("2026-12-31T00:00:00.000Z"))).toBe("31 Dec 2026");
  });
});

describe("formatDateTime", () => {
  it("appends a 24-hour UTC time after the friendly date", () => {
    expect(formatDateTime(new Date("2026-08-20T09:04:00.000Z"))).toBe("20 Aug 2026, 09:04");
  });

  it("zero-pads single-digit hours and minutes", () => {
    expect(formatDateTime(new Date("2026-08-20T01:05:00.000Z"))).toBe("20 Aug 2026, 01:05");
  });
});

describe("toDateInputValue", () => {
  it("renders yyyy-mm-dd for use as a date <input> value", () => {
    expect(toDateInputValue(new Date("2026-08-20T00:00:00.000Z"))).toBe("2026-08-20");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toDateInputValue(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
  });
});

describe("formatMonthYear", () => {
  it("renders an abbreviated month name with the year", () => {
    expect(formatMonthYear(8, 2026)).toBe("Aug 2026");
  });

  it("handles January (month 1) and December (month 12)", () => {
    expect(formatMonthYear(1, 2026)).toBe("Jan 2026");
    expect(formatMonthYear(12, 2026)).toBe("Dec 2026");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  it("renders 'just now' for anything under a minute old", () => {
    expect(formatRelativeTime(new Date("2026-08-20T11:59:31.000Z"), now)).toBe("just now");
  });

  it("renders singular '1 minute ago' for exactly one minute old", () => {
    expect(formatRelativeTime(new Date("2026-08-20T11:59:00.000Z"), now)).toBe("1 minute ago");
  });

  it("renders plural minutes", () => {
    expect(formatRelativeTime(new Date("2026-08-20T11:45:00.000Z"), now)).toBe("15 minutes ago");
  });

  it("renders singular '1 hour ago' for exactly one hour old", () => {
    expect(formatRelativeTime(new Date("2026-08-20T11:00:00.000Z"), now)).toBe("1 hour ago");
  });

  it("renders plural hours", () => {
    expect(formatRelativeTime(new Date("2026-08-20T08:00:00.000Z"), now)).toBe("4 hours ago");
  });

  it("renders singular '1 day ago' for exactly one day old", () => {
    expect(formatRelativeTime(new Date("2026-08-19T12:00:00.000Z"), now)).toBe("1 day ago");
  });

  it("renders plural days, up to 6 days old", () => {
    expect(formatRelativeTime(new Date("2026-08-15T12:00:00.000Z"), now)).toBe("5 days ago");
  });

  it("falls back to the friendly absolute date/time at 7 days or older", () => {
    expect(formatRelativeTime(new Date("2026-08-13T09:04:00.000Z"), now)).toBe("13 Aug 2026, 09:04");
  });

  it("falls back to the friendly absolute date/time for a future timestamp (clock skew)", () => {
    expect(formatRelativeTime(new Date("2026-08-20T13:00:00.000Z"), now)).toBe("20 Aug 2026, 13:00");
  });
});

describe("formatCurrency", () => {
  it("renders whole-number amounts under 1000 without a thousands separator", () => {
    expect(formatCurrency(150)).toBe("Tk 150.00");
  });

  it("groups thousands using the Indian numbering system (lakh-style)", () => {
    expect(formatCurrency(3000)).toBe("Tk 3,000.00");
    expect(formatCurrency(150000)).toBe("Tk 1,50,000.00");
  });

  it("always shows exactly two decimal places", () => {
    expect(formatCurrency(175)).toBe("Tk 175.00");
    expect(formatCurrency(150.5)).toBe("Tk 150.50");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("Tk 0.00");
  });
});
