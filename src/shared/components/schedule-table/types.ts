export type ScheduleTableProps = {
  lines: readonly {
    seq: number;
    dueDate: string;
    amount: number;
    paidAmount?: number;
    status?: string;
  }[];
  estimatedLabel?: string;
  statusLabels?: Readonly<Record<string, string>>;
};
