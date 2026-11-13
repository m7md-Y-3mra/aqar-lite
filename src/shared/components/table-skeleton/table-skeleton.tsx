import { Skeleton } from "@/shared/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/shared/components/ui/table";

type TableSkeletonProps = {
  rows?: number;
  columns: number;
};

export function TableSkeleton({ rows = 5, columns }: TableSkeletonProps) {
  return (
    <Table aria-busy="true" aria-label="جارٍ التحميل">
      <TableBody>
        {Array.from({ length: rows }, (_, row) => (
          <TableRow key={row}>
            {Array.from({ length: columns }, (_, column) => (
              <TableCell key={column}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
