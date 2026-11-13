import { EmptyState } from "@/shared/components/empty-state";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import { formatRiyadhDate } from "@/shared/lib/dates";
import { formatRiyals } from "@/shared/lib/money";
import type { ScheduleTableProps } from "./types";

export function ScheduleTable({ lines, estimatedLabel, statusLabels }: ScheduleTableProps) {
  const showPaid = lines.some((line) => line.paidAmount !== undefined);
  const showStatus = lines.some((line) => line.status !== undefined);
  return (
    <section className="space-y-3" aria-label="جدول الأقساط">
      {estimatedLabel && <p className="text-sm text-muted-foreground">{estimatedLabel}</p>}
      {lines.length === 0 ? <EmptyState message="لا توجد أقساط" /> : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>القسط</TableHead><TableHead>تاريخ الاستحقاق</TableHead>
              <TableHead>المبلغ (ريال)</TableHead>
              {showPaid && <TableHead>المدفوع (ريال)</TableHead>}
              {showStatus && <TableHead>الحالة</TableHead>}
            </TableRow></TableHeader>
            <TableBody>{lines.map((line) => <TableRow key={line.seq}>
              <TableCell>{line.seq === 0 ? "الدفعة المقدمة" : line.seq}</TableCell>
              <TableCell>{formatRiyadhDate(line.dueDate)}</TableCell>
              <TableCell>{formatRiyals(line.amount)}</TableCell>
              {showPaid && <TableCell>{line.paidAmount === undefined ? "—" : formatRiyals(line.paidAmount)}</TableCell>}
              {showStatus && <TableCell>{line.status && <Badge variant="outline">{statusLabels?.[line.status] ?? "—"}</Badge>}</TableCell>}
            </TableRow>)}</TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
