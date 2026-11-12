import { describe, expect, it } from "vitest";

import { loginSchema } from "@/features/auth/auth.schemas";

function fieldErrors(input: unknown) {
  const result = loginSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected login input to be invalid");
  return result.error.flatten().fieldErrors;
}

describe("loginSchema", () => {
  it("normalizes the email address", () => {
    expect(loginSchema.parse({ email: " Ali@X.test ", password: "secret" })).toEqual({
      email: "ali@x.test",
      password: "secret",
    });
  });

  it.each([
    {
      caseName: "a malformed email",
      input: { email: "not-an-email", password: "secret" },
      key: "email" as const,
    },
    {
      caseName: "an empty email",
      input: { email: "", password: "secret" },
      key: "email" as const,
    },
    {
      caseName: "an empty password",
      input: { email: "ali@x.test", password: "" },
      key: "password" as const,
    },
    {
      caseName: "a 255-character email",
      input: { email: `${"a".repeat(248)}@x.test`, password: "secret" },
      key: "email" as const,
    },
    {
      caseName: "a 129-character password",
      input: { email: "ali@x.test", password: "x".repeat(129) },
      key: "password" as const,
    },
  ])("rejects $caseName under the $key field", ({ input, key }) => {
    expect(fieldErrors(input)[key]).toBeDefined();
  });

  it("does not trim the password", () => {
    expect(loginSchema.parse({ email: "ali@x.test", password: " secret " }).password).toBe(
      " secret ",
    );
  });

  it("drops keys that are not part of the login input", () => {
    expect(
      loginSchema.parse({
        email: "ali@x.test",
        password: "secret",
        companyId: "company-id",
        role: "MANAGER",
      }),
    ).toEqual({ email: "ali@x.test", password: "secret" });
  });
});
