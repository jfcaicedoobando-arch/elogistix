let loading: Promise<typeof import("@sentry/react") | null> | null = null;

/** Shared readiness barrier: capture never races the SDK's async bootstrap. */
export function loadInitializedSentry(): Promise<typeof import("@sentry/react") | null> {
  if (!loading) {
    loading = Promise.all([import("@sentry/react"), import("./core")])
      .then(([sdk, core]) => {
        core.initSentry();
        return core.isSentryReady() ? sdk : null;
      }).catch(() => {
        loading = null;
        return null;
      });
  }
  return loading.then((sdk) => {
    if (sdk?.isEnabled()) return sdk;
    // Allow a later successful bootstrap; never expose a disabled/closed SDK.
    loading = null;
    return null;
  });
}
