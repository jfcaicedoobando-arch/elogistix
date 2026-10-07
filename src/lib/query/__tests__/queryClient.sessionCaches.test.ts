import { afterEach, expect, it } from "vitest";
import { queryClient } from "../queryClient";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { registerSessionCache } from "@/lib/auth/sessionCacheRegistry";

afterEach(() => queryClient.clear());
it("invalidates registered data before a mutation's local refetch without revoking auth", async () => {
  const order: string[] = [];
  const operation = captureAuthOperationScope();
  const unregister = registerSessionCache(() => order.push("invalidate-private-data"));
  try {
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: async () => { order.push("write-complete"); },
      onSuccess: () => { order.push("hook-refetch"); expect(operation.isCurrent()).toBe(true); },
    });
    await mutation.execute(undefined);
    expect(order).toEqual(["write-complete", "invalidate-private-data", "hook-refetch"]);
  } finally { unregister(); }
});
