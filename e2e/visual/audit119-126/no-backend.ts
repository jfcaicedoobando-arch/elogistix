// Build-time aliases terminate all backend boundaries before networking.
export const forbiddenBackendAccess = (): never => {
  throw new Error("Backend access forbidden in audit 119/126 fixture");
};
export const supabase = new Proxy({}, { get: forbiddenBackendAccess });
export const useTimbrarRep = () => ({ isPending: false, mutate: forbiddenBackendAccess });
export const useConsultarRep = () => ({ isPending: false, mutate: forbiddenBackendAccess });
// Downloading, stamping, cancellation and preview effects are outside this fixture.
export const FacturaDownloadButton = () => null;
