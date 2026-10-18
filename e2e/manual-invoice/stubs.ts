import { TASA_IVA } from "@/lib/financial/financialUtils";

// Fixture boundary adapters, never application aliases outside this config.
const clientes = [{ id: "synthetic-client", nombre: "Cliente sintético", rfc: "AAA010101AAA",
  codigo_postal: "06000", regimen_fiscal: "601", uso_cfdi_default: "G03", dias_credito: 0 }];
export const useOrgActiva = () => ({ organizationId: "synthetic-org" });
export const useClientesFiscalOpts = () => ({ data: clientes });
export const useTasaIVA = () => TASA_IVA;
export const useIvaFronteraHabilitada = () => new URLSearchParams(location.search).get("border") !== "0";
export const useBanxicoTipoCambio = () => ({ isPending: false, mutate: () => undefined });
export const CreditoExcesoConfirmDialog = () => null;
export const useFacturaManualSubmit = () => ({
  // No imports of submit, persistence, authentication, credit or network services.
  handleSubmit: () => undefined, onConfirmarExceso: () => undefined,
  creditoAlerta: null, setCreditoAlerta: () => undefined,
  resetCaptura: () => undefined, isPending: false,
});
