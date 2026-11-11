import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { CrmEtapaRow, CrmOportunidadRow } from "@/features/crm/hooks";
import { useOportunidadDetalleActions as useActions } from "../../hooks/useOportunidadDetalleActions";

const crear = vi.hoisted(() => vi.fn(async () => ({ id: "cot-1", folio: "COT-1" })));
vi.mock("@/features/crm/hooks", () => ({
  useOportunidadDetalleActions: (...args: Parameters<typeof useActions>) => useActions(...args),
  useEliminarOportunidad: () => ({}),
  useCrearCotizacionDesdeOportunidad: () => ({ mutateAsync: crear, isPending: false }),
}));
vi.mock("@/features/crm/hooks/useCrmProspectoOportunidad", () => ({ useCrmProspectoOportunidad: () => ({ data: null, isLoading: false }) }));
vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canGestionarOportunidad: () => false, canEditSales: true }) }));
vi.mock("@/hooks/shared/useVolver", () => ({ useVolver: () => "/crm/oportunidades" }));
vi.mock("@/features/cliente/hooks", () => ({ useContactosCliente: () => ({ data: [] }) }));
vi.mock("@/features/crm/lib/crmToast", () => ({ crmToast: { success: vi.fn() } }));
vi.mock("@/features/crm/components/NuevaOportunidadDialog", () => ({ default: () => null }));
vi.mock("@/components/shared/DoubleConfirmDeleteDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/ActividadTimeline", () => ({ default: () => null }));
vi.mock("@/features/crm/components/ComentariosOportunidad", () => ({ default: () => null }));
vi.mock("@/features/crm/components/LineageCard", () => ({ OportunidadLineageCard: () => null }));
vi.mock("@/features/crm/components/oportunidadDetalle/OportunidadKpisCards", () => ({ OportunidadKpisCards: () => null }));
vi.mock("@/features/crm/components/oportunidadDetalle/OportunidadGanadaBanner", () => ({ OportunidadGanadaBanner: () => null }));
vi.mock("@/features/crm/components/oportunidadDetalle/ContactoRapidoCard", () => ({ ContactoRapidoCard: () => null }));
vi.mock("@/features/crm/components/oportunidadDetalle/OportunidadResumenTab", () => ({ OportunidadResumenTab: () => null }));
vi.mock("@/features/crm/components/pricing/PricingOportunidadTab", () => ({ PricingOportunidadTab: () => null }));
vi.mock("@/features/crm/components/oportunidadDetalle/MoverEtapaSelect", () => ({ MoverEtapaSelect: () => null }));
vi.mock("@/features/crm/components/objetos/EtiquetaEmpresaEliminada", () => ({ EtiquetaEmpresaEliminada: () => null }));
vi.mock("@/features/crm/components/objetos/EtiquetaSolicitudRespondida", () => ({ EtiquetaSolicitudRespondida: () => null }));

import { OportunidadDetalleContent } from "../oportunidadDetalle/OportunidadDetalleContent";

it.each([ ["puerto-sha", "puerto-zlo"], [null, null] ])("Nueva cotización lleva la identidad de ruta %s / %s sin inferirla del nombre", async (origenId, destinoId) => {
  const op = { id: "op-1", nombre: "Importación", cliente_id: "cli-1", cliente_nombre: "Cliente", etapa_id: "e-1", modo: "Marítimo",
    origen: "Shanghai", destino: "Manzanillo", puerto_origen_id: origenId, puerto_destino_id: destinoId } as CrmOportunidadRow;
  const etapas = [{ id: "e-1", nombre: "En cotización", tipo: "abierta" }] as CrmEtapaRow[];
  render(<MemoryRouter><OportunidadDetalleContent op={op} etapas={etapas} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Nueva cotización" }));
  await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ oportunidad: expect.objectContaining({
    id: "op-1", cliente_id: "cli-1", origen: "Shanghai", destino: "Manzanillo", puerto_origen_id: origenId, puerto_destino_id: destinoId,
  }) })));
});
