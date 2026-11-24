import {
  Building2,
  CalendarClock,
  Circle,
  FileText,
  House,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/": House,
  "/units": Building2,
  "/clients": Users,
  "/reservations": CalendarClock,
  "/contracts": FileText,
  "/audit-log": ScrollText,
};

export function navIconFor(href: string): LucideIcon {
  return NAV_ICONS[href] ?? Circle;
}
