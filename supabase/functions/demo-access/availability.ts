/** Server-owned contract only. Never pass Request/body/header/query data here. */
export type DemoAvailabilityProvider = () => Promise<unknown>;

/** Missing, inactive, ambiguous and failed decisions all keep demo access closed. */
export async function demoIsAvailable(provider?: DemoAvailabilityProvider): Promise<boolean> {
  if (!provider) return false;
  try {
    const decision = await provider();
    if (decision === null || typeof decision !== "object" || Array.isArray(decision)) return false;
    const fields = Object.getOwnPropertyDescriptors(decision);
    return Reflect.ownKeys(decision).length === 2 &&
      fields.available?.value === true && fields.state?.value === "active";
  } catch {
    // Neither provider internals nor credentials belong in this public response.
    return false;
  }
}
