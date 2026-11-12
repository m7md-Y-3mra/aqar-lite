export type MoneyInputProps = {
  value: number | undefined;
  onChange: (halalas: number) => void;
  onBlur?: () => void;
  id: string;
  name: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};
