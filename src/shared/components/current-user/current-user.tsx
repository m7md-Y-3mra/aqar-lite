"use client";

import { createContext } from "react";

import type { CurrentUserProviderProps, ShellUser } from "./types";

export const CurrentUserContext = createContext<ShellUser | undefined>(undefined);

export function CurrentUserProvider({ user, children }: CurrentUserProviderProps) {
  return <CurrentUserContext value={user}>{children}</CurrentUserContext>;
}
