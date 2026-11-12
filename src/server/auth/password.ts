import "server-only";

import { verify } from "@node-rs/argon2";

// Generated with the same hash() defaults as prisma/run-seed.ts; never computed at runtime.
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$0trxTFbWjxJvm9M3elO4eQ$hkUKAU+G4/0hupWgTDOMuUClhlaxKEGIAhvwrYfGVQg";

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await verify(hash, password);
  } catch {
    return false;
  }
}
