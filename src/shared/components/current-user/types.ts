import type { Role } from "@/shared/lib/roles";

export type ShellUser = {
  name: string;
  role: Role;
  companyName: string;
};

export type CurrentUserProviderProps = {
  user: ShellUser;
  children: React.ReactNode;
};
