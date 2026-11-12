import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "@/server/http/error-codes";
import { ERROR_MESSAGES } from "@/shared/lib/error-messages";

describe("error messages", () => {
  it("has an Arabic message for every error code and no extra keys", () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual(Object.keys(ERROR_CODES).sort());
    for (const message of Object.values(ERROR_MESSAGES)) {
      expect(message).toMatch(/[؀-ۿ]/);
    }
  });
});
