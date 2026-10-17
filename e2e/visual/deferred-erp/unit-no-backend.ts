// Existing tests provide their own vi.mock; an unexpected real import fails closed.
export const supabase = new Proxy({}, {
  get(_target, property) { throw new Error(`Real Supabase forbidden in local suites: ${String(property)}`); },
});
