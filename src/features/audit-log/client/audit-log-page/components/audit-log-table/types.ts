import type { AuditEventDto } from "../../../../audit-log.types";

export type AuditLogTableProps = { events: AuditEventDto[]; dimmed: boolean };
