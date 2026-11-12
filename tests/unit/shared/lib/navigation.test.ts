import { describe, expect, it } from "vitest";

import { filterNavItems, NAV_ITEMS, navItemsFor } from "@/shared/lib/navigation";
import type { NavItem } from "@/shared/lib/navigation";
import { ROLES } from "@/shared/lib/roles";

const items: NavItem[] = [
  { href: "/", label: "الرئيسية", roles: ROLES },
  { href: "/audit-log", label: "سجل التدقيق", roles: ["MANAGER"] },
];

describe("navigation", () => {
  it.each(ROLES)("shows Home and units for %s in the configured navigation", (role) => {
    expect(navItemsFor(role)).toEqual([
      { href: "/", label: "الرئيسية", roles: ROLES },
      { href: "/units", label: "الوحدات", roles: ROLES },
    ]);
    expect(navItemsFor(role)).toEqual(filterNavItems(NAV_ITEMS, role));
  });

  it("includes manager-only items for a manager", () => {
    expect(filterNavItems(items, "MANAGER")).toEqual(items);
  });

  it.each(["SALES", "ACCOUNTANT"] as const)("hides manager-only items from %s", (role) => {
    expect(filterNavItems(items, role)).toEqual([items[0]]);
  });

  it("does not mutate the input list", () => {
    const original = structuredClone(items);
    filterNavItems(items, "SALES");
    expect(items).toEqual(original);
  });
});
