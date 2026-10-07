/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryKeys } from "@/lib/query";
import type { ClienteFiscalRow, DefaultsFacturacionCliente } from "../../services";

const mocks = vi.hoisted(() => ({
  guardar: vi.fn(), actualizar: vi.fn(), fiscal: vi.fn(), defaults: vi.fn(),
  estado: { preferencia: "G03", efectivo: "G01" as string | undefined },
}));
vi.mock("@/features/facturacion/services", () => ({ actualizarDatosTimbradoFactura: mocks.actualizar, guardarDefaultsTimbradoCliente: mocks.guardar }));
vi.mock("@/features/facturacion/services/enviarCfdiEmail", () => ({ enviarCfdiFactura: vi.fn() }));
vi.mock("@/features/facturacion/hooks/useTimbrarFactura", () => ({ useTimbrarFactura: () => ({ isPending: false,
  mutate: (_id: string, opts: { onSuccess: (result: unknown) => Promise<void> }) => void opts.onSuccess({
    uuid: "uuid", uso_cfdi_solicitado: "G01", uso_cfdi_efectivo: mocks.estado.efectivo,
    fuente_uso_cfdi: mocks.estado.efectivo ? "xml" : undefined,
  }),
}) }));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));
import { useTimbrarFacturaDialog } from "../useTimbrarFacturaDialog";

const cliente: ClienteFiscalRow = { rfc: "AAA010101AAA", codigo_postal: "64000", regimen_fiscal: "601", uso_cfdi_default: "G03" };
const defaults: DefaultsFacturacionCliente = { uso_cfdi: "G03", forma_pago: "03", metodo_pago: "PUE", cc_emails: null, destinatarios_emails: null };
const factura = { id: "f1", cliente_id: "c1", uso_cfdi: "G01" as string | null, forma_pago: "03", metodo_pago: "PUE" };

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } } });
  qc.setQueryData(queryKeys.facturacion.clienteFiscal("c1"), cliente);
  qc.setQueryData(queryKeys.facturacion.clienteDefaults("c1"), defaults);
  const onClose = vi.fn();
  const hook = renderHook(({ actual }) => {
    const fiscal = useQuery<ClienteFiscalRow>({ queryKey: queryKeys.facturacion.clienteFiscal("c1"), queryFn: mocks.fiscal });
    const preferencias = useQuery<DefaultsFacturacionCliente>({ queryKey: queryKeys.facturacion.clienteDefaults("c1"), queryFn: mocks.defaults, staleTime: 30_000 });
    return useTimbrarFacturaDialog(actual, fiscal.data, preferencias.data, onClose);
  }, { initialProps: { actual: factura }, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
  return { ...hook, qc, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.estado.preferencia = "G03";
  mocks.estado.efectivo = "G01";
  mocks.actualizar.mockResolvedValue(undefined);
  mocks.guardar.mockImplementation(async (_id, patch: { uso_cfdi_default?: string }) => {
    if (patch.uso_cfdi_default) mocks.estado.preferencia = patch.uso_cfdi_default;
  });
  mocks.fiscal.mockImplementation(async () => ({ ...cliente, uso_cfdi_default: mocks.estado.preferencia }));
  mocks.defaults.mockImplementation(async () => ({ ...defaults, uso_cfdi: mocks.estado.preferencia }));
});

describe("preferencia guardada y ambas cachés de React Query", () => {
  it("G03→G01 actualiza clienteFiscal/RPC y la siguiente factura sin uso abre con G01", async () => {
    const { result, rerender, qc, onClose } = setup();
    expect(mocks.fiscal).not.toHaveBeenCalled(); // La caché inicial sigue fresca durante 60 s.
    await act(() => result.current.onConfirm());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    await waitFor(() => {
      expect(qc.getQueryData<ClienteFiscalRow>(queryKeys.facturacion.clienteFiscal("c1"))?.uso_cfdi_default).toBe("G01");
      expect(qc.getQueryData<DefaultsFacturacionCliente>(queryKeys.facturacion.clienteDefaults("c1"))?.uso_cfdi).toBe("G01");
    });
    expect(mocks.fiscal).toHaveBeenCalledOnce();
    expect(mocks.defaults).toHaveBeenCalledOnce();
    rerender({ actual: { ...factura, id: "f2", uso_cfdi: null } });
    expect(result.current.usoCfdi).toBe("G01");
    qc.clear();
  });
  it.each(["S01", undefined])("XML distinto/ausente (%s) no reemplaza la preferencia explícita cacheada", async (efectivo) => {
    mocks.estado.efectivo = efectivo;
    const { result, rerender, qc, onClose } = setup();
    await act(() => result.current.onConfirm());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mocks.guardar).toHaveBeenCalledWith("c1", { forma_pago_default: "03", metodo_pago_default: "PUE" });
    expect(qc.getQueryData<ClienteFiscalRow>(queryKeys.facturacion.clienteFiscal("c1"))?.uso_cfdi_default).toBe("G03");
    expect(qc.getQueryData<DefaultsFacturacionCliente>(queryKeys.facturacion.clienteDefaults("c1"))?.uso_cfdi).toBe("G03");
    rerender({ actual: { ...factura, id: "f2", uso_cfdi: null } });
    expect(result.current.usoCfdi).toBe("G03");
    qc.clear();
  });
});
