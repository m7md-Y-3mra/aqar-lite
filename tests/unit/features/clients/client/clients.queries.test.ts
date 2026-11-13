import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/shared/lib/api-client";
import { clientKeys } from "@/features/clients/clients.keys";
import { clientDetailOptions, clientListOptions } from "@/features/clients/client/clients.queries";

vi.mock("@/shared/lib/api-client", () => ({ apiFetch: vi.fn() }));

describe("client query options", () => {
  it("uses the shared list key and URL pagination", async () => {
    const query = { page: 2, pageSize: 50 };
    const options = clientListOptions(query);
    expect(options.queryKey).toEqual(clientKeys.list(query));
    await (options.queryFn as () => Promise<unknown>)();
    expect(apiFetch).toHaveBeenCalledWith("/api/clients?page=2&pageSize=50");
  });

  it("uses the shared detail key and endpoint", async () => {
    const options = clientDetailOptions("client-id");
    expect(options.queryKey).toEqual(clientKeys.detail("client-id"));
    await (options.queryFn as () => Promise<unknown>)();
    expect(apiFetch).toHaveBeenCalledWith("/api/clients/client-id");
  });
});
