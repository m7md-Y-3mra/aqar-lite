import { describe, expect, it } from "vitest";

import { formatRiyals, parseRiyals, toRiyalText } from "@/shared/lib/money";

describe("parseRiyals", () => {
  it.each([
    ["1500", 150000],
    ["1500.5", 150050],
    ["1500.05", 150005],
    ["0.01", 1],
    ["0", 0],
    [" 1500.50 ", 150050],
  ])("parses %s to %i", (text, halalas) => {
    expect(parseRiyals(text)).toBe(halalas);
  });

  it.each(["1500.555", "-1", "abc", "", " ", "1e3", "0x10", "1,500", ".5", "1."])(
    "rejects %j",
    (text) => {
      expect(parseRiyals(text)).toBeNull();
    },
  );

  it("rejects values outside the safe integer range", () => {
    expect(parseRiyals("90071992547409.92")).toBeNull();
  });
});

describe("formatRiyals", () => {
  it("formats halalas as riyals with Latin digits", () => {
    expect(formatRiyals(150050)).toBe("1,500.50");
    expect(formatRiyals(5)).toBe("0.05");
  });

  it("formats amounts above float precision exactly", () => {
    expect(formatRiyals(Number.MAX_SAFE_INTEGER)).toBe("90,071,992,547,409.91");
  });
});

describe("toRiyalText", () => {
  it.each([
    [150050, "1500.5"],
    [150000, "1500"],
    [5, "0.05"],
    [0, "0"],
    [Number.MAX_SAFE_INTEGER, "90071992547409.91"],
  ])("formats %i as %s and round-trips", (halalas, text) => {
    expect(toRiyalText(halalas)).toBe(text);
    expect(parseRiyals(toRiyalText(halalas))).toBe(halalas);
  });
});
