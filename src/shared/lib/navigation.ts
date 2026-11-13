import { ROLES, type Role } from "@/shared/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  roles: readonly Role[];
};

/* Navigation map: add each item only when its page exists.
 * الرئيسية | /             | MANAGER, SALES, ACCOUNTANT
 * الوحدات  | /units        | MANAGER, SALES, ACCOUNTANT
 * العملاء  | /clients      | MANAGER, SALES, ACCOUNTANT
 * الحجوزات | /reservations | MANAGER, SALES
 * العقود   | /contracts    | MANAGER, SALES, ACCOUNTANT
 * سجل التدقيق | /audit-log | MANAGER
 * Navigation is display-only; server authorization is still required.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "الرئيسية", roles: ROLES },
  { href: "/units", label: "الوحدات", roles: ROLES },
  { href: "/clients", label: "العملاء", roles: ROLES },
  { href: "/reservations", label: "الحجوزات", roles: ["MANAGER", "SALES"] },
];

export function filterNavItems(items: readonly NavItem[], role: Role): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}

export function navItemsFor(role: Role): NavItem[] {
  return filterNavItems(NAV_ITEMS, role);
}
