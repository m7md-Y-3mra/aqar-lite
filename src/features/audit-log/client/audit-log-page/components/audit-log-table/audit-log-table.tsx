import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatRiyadhDateTime } from "@/shared/lib/dates";
import { AuditEventBadge } from "../audit-event-badge";
import { AuditEventDetails } from "../audit-event-details";
import type { AuditLogTableProps } from "./types";

export function AuditLogTable({ events, dimmed }: AuditLogTableProps) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <Table
        aria-label="سجل التدقيق"
        aria-busy={dimmed}
        className={dimmed ? "opacity-50" : undefined}
      >
        <TableHeader>
          <TableRow>
            <TableHead>النوع</TableHead>
            <TableHead>الوقت</TableHead>
            <TableHead>المستخدم</TableHead>
            <TableHead>التفاصيل</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <AuditEventBadge action={event.action} />
              </TableCell>
              <TableCell>
                <span dir="ltr">{formatRiyadhDateTime(event.createdAt)}</span>
              </TableCell>
              <TableCell>
                {event.action === "LOGIN_FAILED" ? (
                  <span dir="ltr" className="block max-w-48 truncate" title={event.details?.email}>
                    {event.details?.email ?? "—"}
                  </span>
                ) : (
                  (event.actorName ?? "—")
                )}
              </TableCell>
              <TableCell>
                <AuditEventDetails event={event} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
