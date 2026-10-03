import { AsyncLocalStorage } from "node:async_hooks";
import type { SentryEdgeSDK } from "./sentryRuntime.ts";

type EdgeScope = InstanceType<SentryEdgeSDK["Scope"]>;
const requests = new AsyncLocalStorage<EdgeScope>();

/** Only our manual reports inherit this scope; no global SDK/runtime patching. */
export function runWithEdgeScope<T>(scope: EdgeScope, callback: () => T): T {
  return requests.run(scope, callback);
}

export function getEdgeScope(): EdgeScope | undefined {
  return requests.getStore()?.clone();
}
