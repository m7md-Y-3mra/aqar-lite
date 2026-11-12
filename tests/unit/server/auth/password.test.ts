import { hash } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";

import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/server/auth/password";

describe("password verification", () => {
  it("returns false instead of throwing for a malformed hash", async () => {
    await expect(verifyPassword("fixture-password-hash", "x")).resolves.toBe(false);
  });

  it("uses a hard-coded Argon2id hash with the seed defaults", () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it("does not match an arbitrary password against the dummy hash", async () => {
    await expect(verifyPassword(DUMMY_PASSWORD_HASH, "anything")).resolves.toBe(false);
  });

  it("verifies a freshly hashed password", async () => {
    const passwordHash = await hash("pw");

    await expect(verifyPassword(passwordHash, "pw")).resolves.toBe(true);
  });
});
