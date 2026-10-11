import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccionesProforma } from "../AccionesProforma";
import type { ProformaDetalleFull } from "../../services";

vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canEmitirFactura: true, canResponderProformaManual: true, canEditarProforma: true }) }));
vi.mock("@/features/proformas/hooks/useConvertirProformaDirecto", () => ({ useConvertirProformaDirecto: () => ({ convertir: vi.fn() }) }));
vi.mock("@/features/proformas/hooks/useAprobarProformaInterna", () => ({ useAprobarProformaInterna: () => ({ aprobar: vi.fn() }) }));
vi.mock("@/features/cliente/hooks/useClienteAutorizacion", () => ({ useClienteAutorizacion: () => ({ autorizacion: { requiereAutorizacionProforma: false } }) }));
vi.mock("@/features/cliente/hooks/useValidarLimiteCredito", () => ({ useValidarLimiteCredito: () => vi.fn(), registrarExcesoCredito: vi.fn() }));
vi.mock("@/features/proformas/components/EnviarProformaDialog", () => ({ EnviarProformaDialog: () => null }));
vi.mock("@/features/proformas/components/RespuestaClienteManualDialog", () => ({ RespuestaClienteManualDialog: () => null }));
vi.mock("@/features/proformas/components/AlertaLimiteCreditoDialog", () => ({ AlertaLimiteCreditoDialog: () => null }));
vi.mock("@/components/shared/BadgeClienteDeCasa", () => ({ BadgeClienteDeCasa: () => null }));
vi.mock("@/components/shared/DetalleActionBar", () => ({ DetalleActionBar: ({ primary, secondary }: { primary: { label: string } | null; secondary: { id: string; label: string }[] }) => <>{primary && <button>{primary.label}</button>}{secondary.map(i => <button key={i.id}>{i.label}</button>)}</> }));

describe("detalle histórico cancelado", () => {
  it.each(["pendiente", "aceptada"])("mantiene PDF sin enviar, aprobar o facturar (%s)", estado_cliente => {
    const proforma = { id: "history", estado_proforma: "cancelada", estado_cliente, factura_id: null } as ProformaDetalleFull;
    render(<AccionesProforma proforma={proforma} downloadingId={null} onDescargar={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enviar al cliente/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aprobar internamente" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Crear borrador de factura" })).toBeNull();
    expect(screen.queryByText(/Aprueba internamente para continuar/)).toBeNull();
  });
});
