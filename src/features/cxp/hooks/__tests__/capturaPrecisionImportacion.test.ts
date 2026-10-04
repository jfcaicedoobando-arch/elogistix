import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CfdiParsedResponse } from "../../services/parseCfdi.types";

const { crear, persistir, notifyError, buscarProveedor } = vi.hoisted(() => ({
  crear: vi.fn(), persistir: vi.fn(), notifyError: vi.fn(), buscarProveedor: vi.fn(),
}));
// Aislamiento explícito: cualquier I/O no previsto falla localmente, nunca usa .env.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => { throw new Error("Supabase I/O no simulado en este test"); }),
    rpc: vi.fn(() => { throw new Error("Supabase RPC no simulado en este test"); }) },
}));

vi.mock("@/lib/ui/appFeedback", () => ({ notifyError, notifySuccess: vi.fn(), notifyInfo: vi.fn() }));
vi.mock("@/features/cxp/services", async () => {
  const { validarCuadreCfdi } = await import("../../services/validarCuadreCfdi");
  return { validarCuadreCfdi, buscarFacturaDuplicadaFolio: vi.fn().mockResolvedValue(null) };
});
vi.mock("@/features/proveedor/services", () => ({ findProveedorByRfcEnOrg: buscarProveedor }));
vi.mock("../useNuevaFacturaProveedorForm.dup", () => ({
  buscarCfdiDuplicado: vi.fn().mockResolvedValue({ estado: "no_existe" }),
  describirFacturaExistente: vi.fn(),
}));
vi.mock("../useNuevaFacturaProveedorForm.sideEffects", () => ({
  uploadCfdiSafe: vi.fn(), persistirConceptosCfdiSafe: persistir,
  vincularSafe: vi.fn().mockResolvedValue({}), aprenderAliasProveedorSafe: vi.fn(),
  buildFacturaSuccessDescription: vi.fn(),
}));
import { aplicarPdfIaParsed, type ParsedApplyDeps } from "../useNuevaFacturaProveedorForm.applyParsed";
import { runSubmit } from "../useNuevaFacturaProveedorForm.submit";
import { procesarCfdiParsed } from "../useNuevaFacturaProveedorForm.cfdi";
import { initialValues } from "../useNuevaFacturaProveedorForm.helpers";

const conceptos = [{ descripcion: "Almacenaje", cantidad: 100, importe: 0.014, iva: 0, ieps: 0 }];
function params(subtotal: string) {
  return {
    values: { ...initialValues(), provId: "p1", folio: "PRECISION", categoriaId: "cat", subtotal },
    total: Number(subtotal), userId: "u1", organizationId: "org", pendingCfdi: null,
    cfdiConceptos: conceptos, vinculos: {}, embarqueAdHoc: null,
    crearMutateAsync: crear, setFolioError: vi.fn(),
  };
}
function documento(): CfdiParsedResponse {
  return { cfdi: {
    uuid: "uuid", serie: "A", folio: "1", fecha: "2026-10-04", moneda: "MXN", tipo_cambio: 1,
    subtotal: 1.4, total: 1.4, iva_trasladado: 0, ieps_trasladado: 0, retenciones: 0,
    tipo_comprobante: "I", emisor: { rfc: "XAXX010101000", nombre: "Proveedor", regimen: "601" },
    receptor: { rfc: "XAXX010101000", nombre: "Cliente" }, conceptos,
  }, ai: { categoria_id: "cat", notas: "" } };
}
beforeEach(() => { vi.clearAllMocks(); crear.mockResolvedValue({ id: "f1" }); });

describe("captura · validación antes de cualquier escritura", () => {
  it("bloquea cabecera 1.40 con líneas persistibles 1.00 aunque no haya costos vinculados", async () => {
    expect(await runSubmit(params("1.4"))).toEqual({ ok: false, facturaId: null });
    expect(crear).not.toHaveBeenCalled();
    expect(persistir).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: "Los conceptos no cuadran con el subtotal",
    }));
  });

  it("guarda cabecera y conceptos normalizados usando exactamente la misma representación", async () => {
    expect(await runSubmit(params("1"))).toEqual({ ok: true, facturaId: "f1" });
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 1, total: 1 }));
    expect(persistir).toHaveBeenCalledWith(expect.objectContaining({
      conceptos: [expect.objectContaining({ cantidad: 100, importe: 0.01 })],
    }));
  });

  it("bloquea cantidades sub-micro antes de crear la cabecera", async () => {
    const p = { ...params("1"), cfdiConceptos: [{ ...conceptos[0], cantidad: 0.0000001 }] };
    expect(await runSubmit(p)).toEqual({ ok: false, facturaId: null });
    expect(crear).not.toHaveBeenCalled();
  });

  it("la importación usa la misma tolerancia estricta de subtotal que el guardado", async () => {
    const data = documento();
    data.cfdi.subtotal = 100.02;
    data.cfdi.total = 100.02;
    data.cfdi.conceptos = [{ ...conceptos[0], cantidad: 1, importe: 100 }];
    expect(await procesarCfdiParsed(data, { xml: new File(["xml"], "factura.xml"), pdf: null }, "org"))
      .toMatchObject({ ok: false, cuadreError: expect.stringContaining("0.01") });
  });

  it("el PDF propone líneas normalizadas sin reescribir la cabecera declarada", async () => {
    buscarProveedor.mockResolvedValue({ id: "p1", nombre: "Proveedor" });
    const deps: ParsedApplyDeps = {
      organizationId: "org", setValues: vi.fn(), setErrors: vi.fn(), setPendingCfdi: vi.fn(),
      setCfdiConceptos: vi.fn(), setAskCrearProv: vi.fn(), setTcOrigen: vi.fn(),
      setTcFechaAplicada: vi.fn(), manualTcRef: { current: false },
    };
    const data = documento();
    expect(await aplicarPdfIaParsed(deps, data, { pdf: new File(["pdf"], "factura.pdf") })).toBe(true);
    expect(deps.setValues).toHaveBeenCalledWith(expect.objectContaining({ subtotal: "1.4" }));
    expect(deps.setCfdiConceptos).toHaveBeenCalledWith([expect.objectContaining({ cantidad: 100, importe: 0.01 })]);
    expect(data.cfdi.conceptos[0].importe).toBe(0.014);
    expect(crear).not.toHaveBeenCalled();
  });

  it("valida el XML después de normalizar sin alterar los totales declarados", async () => {
    const data = documento();
    const result = await procesarCfdiParsed(data, { xml: new File(["xml"], "factura.xml"), pdf: null }, "org");
    expect(result).toMatchObject({ ok: false, cuadreError: expect.stringContaining("1.00") });
    expect(buscarProveedor).not.toHaveBeenCalled();
    expect(data.cfdi.subtotal).toBe(1.4);
    expect(data.cfdi.conceptos[0].importe).toBe(0.014);
  });
});
