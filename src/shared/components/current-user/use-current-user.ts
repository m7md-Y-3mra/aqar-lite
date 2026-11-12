"use client";

import { use } from "react";

import { CurrentUserContext } from "./current-user";

export function useCurrentUser() {
  const user = use(CurrentUserContext);
  if (user === undefined) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return user;
}
