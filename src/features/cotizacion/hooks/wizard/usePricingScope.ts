import { useSyncExternalStore } from "react";
import { captureAuthDataScope } from "@/lib/auth/authOperationScope";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";

/** La generación revoca en seguida caché y continuaciones incluso al volver al mismo tenant. */
export function usePricingScope() {
  useSyncExternalStore(subscribeSessionCacheGeneration, getSessionCacheGeneration, getSessionCacheGeneration);
  return captureAuthDataScope();
}
