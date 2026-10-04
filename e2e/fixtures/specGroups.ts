/** Una sola clasificación: todo flujo que escribe en el servidor es serial. */
export const MUTATOR_FLOW_IDS = ["08", "09", "10", "11", "12", "25", "28", "30"] as const;
export const READ_ONLY_FLOW_IDS = ["01", "02", "03", "04", "06", "07", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "29", "31", "32"] as const;
export function mutatorPattern(required?: string) {
  const ids = required === undefined ? [...MUTATOR_FLOW_IDS] : required.split(",").map(id => id.trim());
  if (!ids.length || ids.some(id => !MUTATOR_FLOW_IDS.some(known => known === id))) throw new Error("E2E_REQUIRED_FLOWS debe listar IDs mutadores válidos (08,09,10,11,12,25,28,30).");
  return new RegExp("(?:^|[\\\\/])(?:" + ids.map(id => id + "-").join("|") + ")");
}
export const MUTATOR_SPECS = mutatorPattern();
export const PORTAL_SPEC = /05-portal\.spec\.ts$/;
export const MULTI_TENANT_SPEC = /26-multi-tenant-isolation\.spec\.ts$/;
