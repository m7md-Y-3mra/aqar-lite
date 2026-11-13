import { describe, expect, it } from "vitest";

import { formatRiyadhDateTime, formatTimeLeft } from "@/shared/lib/dates";

describe("dates", () => {
  it("formats 2026-11-12T21:30Z as 2026/11/13 00:30 (Riyadh)", () => {
    expect(formatRiyadhDateTime("2026-11-12T21:30:00Z")).toBe("2026/11/13 00:30");
  });

  it("time left 71 h 59 m", () => {
    expect(formatTimeLeft("2026-11-15T21:29:00Z", "2026-11-12T21:30:00Z")).toBe(
      "71 ساعة و 59 دقيقة",
    );
  });

  it("formats minutes without hours", () => {
    expect(formatTimeLeft("2026-11-12T21:59:00Z", "2026-11-12T21:30:00Z")).toBe("29 دقيقة");
  });

  it("less than a minute", () => {
    expect(formatTimeLeft("2026-11-12T21:30:59Z", "2026-11-12T21:30:00Z")).toBe("أقل من دقيقة");
  });

  it("never negative", () => {
    expect(formatTimeLeft("2026-11-12T20:30:00Z", "2026-11-12T21:30:00Z")).toBe("أقل من دقيقة");
    expect(formatTimeLeft("2026-11-12T21:30:00Z", "2026-11-12T21:30:00Z")).toBe("أقل من دقيقة");
  });
});
