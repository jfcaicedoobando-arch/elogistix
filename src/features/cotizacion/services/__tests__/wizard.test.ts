import { describe, it, expect, vi, beforeEach } from "vitest";

const { uploadFileMock } = vi.hoisted(() => ({ uploadFileMock: vi.fn(async () => undefined) }));
vi.mock("@/services/storage/index", () => ({ uploadFile: uploadFileMock }));
vi.mock("@/lib/supabase/cast", () => ({ fromDb: <T,>(x: unknown) => x as T }));
// v13.420.0: la ruta del MSDS ahora inicia con el organization_id (RLS).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: "00000000-0000-0000-0000-000000000001", error: null })),
  },
}));


import { savePaso1, savePaso2, savePaso3, savePasoFinal, derivarSubtotalMoneda, MSG_COTIZACION_MIXTA } from "../wizard";

function makeForm(over: Record<string, unknown> = {}) {
  return {
    getValues: () => ({ tipoCarga: "Carga General", ...over }) as never,
  };
}
const muts = {
  crearCotizacion: { mutateAsync: vi.fn(async () => ({ id: "cot1" })) },
  updateCotizacion: { mutateAsync: vi.fn(async () => undefined) },
  upsertCostos: { mutateAsync: vi.fn(async () => ({ costos: [], updatedAt: "2026-09-03T12:00:00Z" })) },
};

beforeEach(() => {
  uploadFileMock.mockClear();
  muts.crearCotizacion.mutateAsync.mockClear();
  muts.updateCotizacion.mutateAsync.mockClear();
  muts.upsertCostos.mutateAsync.mockClear();
});

describe("savePaso1", () => {
  it("crea cotización nueva cuando cotizacionId es null", async () => {
    const id = await savePaso1({
      form: makeForm(), msdsFile: null, cotizacionId: null,
      buildPaso1Data: () => ({ folio: "F1" }),
      mutations: muts,
    });
    expect(id).toBe("cot1");
    expect(muts.crearCotizacion.mutateAsync).toHaveBeenCalledTimes(1);
    expect(muts.updateCotizacion.mutateAsync).not.toHaveBeenCalled();
  });

  it("actualiza cotización existente cuando cotizacionId está presente", async () => {
    const id = await savePaso1({
      form: makeForm(), msdsFile: null, cotizacionId: "existente",
      buildPaso1Data: () => ({ folio: "F2" }),
      mutations: muts,
    });
    expect(id).toBe("existente");
    expect(muts.updateCotizacion.mutateAsync).toHaveBeenCalledWith({
      id: "existente",
      data: expect.objectContaining({ folio: "F2" }),
    });
  });

  // BL-3: editar sin volver a subir el MSDS NO debe borrar el ya guardado.
  it("no toca msds_archivo en UPDATE cuando no hay archivo nuevo", async () => {
    await savePaso1({
      form: makeForm({ tipoCarga: "Mercancía Peligrosa" }), msdsFile: null, cotizacionId: "existente",
      buildPaso1Data: () => ({ folio: "F2" }),
      mutations: muts,
    });
    const arg = muts.updateCotizacion.mutateAsync.mock.calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect("msds_archivo" in arg[0].data).toBe(false);
  });


  it("sube MSDS sólo cuando tipoCarga es 'Mercancía Peligrosa' y hay archivo", async () => {
    const file = new File(["x"], "ficha.pdf", { type: "application/pdf" });
    await savePaso1({
      form: makeForm({ tipoCarga: "Mercancía Peligrosa" }),
      msdsFile: file, cotizacionId: null,
      buildPaso1Data: () => ({}), mutations: muts,
    });
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
    const arg = (uploadFileMock.mock.calls[0] as unknown as [string])[0];
    expect(arg.startsWith("00000000-0000-0000-0000-000000000001/msds/")).toBe(true);
    expect(arg.endsWith(".pdf")).toBe(true);
  });

  // W-13 (QA r2): sin cotización creada no debe existir archivo en storage.
  it("crea la cotización ANTES de subir el MSDS y luego la actualiza", async () => {
    const orden: string[] = [];
    muts.crearCotizacion.mutateAsync.mockImplementationOnce(async () => {
      orden.push("crear");
      return { id: "cot1" };
    });
    uploadFileMock.mockImplementationOnce(async () => {
      orden.push("upload");
      return undefined;
    });
    const file = new File(["x"], "ficha.pdf", { type: "application/pdf" });
    await savePaso1({
      form: makeForm({ tipoCarga: "Mercancía Peligrosa" }),
      msdsFile: file, cotizacionId: null,
      buildPaso1Data: () => ({}), mutations: muts,
    });
    expect(orden).toEqual(["crear", "upload"]);
    const patch = muts.updateCotizacion.mutateAsync.mock.calls[0] as unknown as [
      { id: string; data: { msds_archivo: string } },
    ];
    expect(patch[0].id).toBe("cot1");
    expect(patch[0].data.msds_archivo).toContain("/msds/");
  });

  it("no deja huérfano el MSDS si falla la creación de la cotización", async () => {
    muts.crearCotizacion.mutateAsync.mockRejectedValueOnce(new Error("boom"));
    const file = new File(["x"], "ficha.pdf", { type: "application/pdf" });
    await expect(
      savePaso1({
        form: makeForm({ tipoCarga: "Mercancía Peligrosa" }),
        msdsFile: file, cotizacionId: null,
        buildPaso1Data: () => ({}), mutations: muts,
      }),
    ).rejects.toThrow("boom");
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it("no sube MSDS si tipoCarga es general aunque haya archivo", async () => {
    const file = new File(["x"], "ficha.pdf", { type: "application/pdf" });
    await savePaso1({
      form: makeForm({ tipoCarga: "Carga General" }),
      msdsFile: file, cotizacionId: null,
      buildPaso1Data: () => ({}), mutations: muts,
    });
    expect(uploadFileMock).not.toHaveBeenCalled();
  });
});

describe("savePaso2", () => {
  it("no llama upsertCostos si la lista está vacía", async () => {
    await savePaso2({ cotizacionId: "c1", costosInternos: [], mutations: muts });
    expect(muts.upsertCostos.mutateAsync).not.toHaveBeenCalled();
  });

  it("calcula costo_total = cantidad × costo_unitario", async () => {
    await savePaso2({
      cotizacionId: "c1",
      costosInternos: [{
        concepto: "Flete", moneda: "USD", proveedor: "X",
        cantidad: 3, costo_unitario: 100, precio_venta: 150,
        unidad_medida: "unidad", notas: undefined,
      }],
      mutations: muts,
    });
    const arg = (muts.upsertCostos.mutateAsync.mock.calls[0] as unknown as [{ costos: Array<{ costo_total: number; notas: string }> }])[0];
    expect(arg.costos[0].costo_total).toBe(300);
    expect(arg.costos[0].notas).toBe("");
  });

  it("manda el sello esperado y devuelve el nuevo sello (resincronización)", async () => {
    const nuevo = await savePaso2({
      cotizacionId: "c1",
      costosInternos: [{
        concepto: "Flete", moneda: "USD", proveedor: "X",
        cantidad: 1, costo_unitario: 100, precio_venta: 150,
        unidad_medida: "unidad", notas: undefined,
      }],
      expectedUpdatedAt: "2026-09-03T11:00:00Z",
      mutations: muts,
    });
    const arg = (muts.upsertCostos.mutateAsync.mock.calls[0] as unknown as [{ expectedUpdatedAt: string }])[0];
    expect(arg.expectedUpdatedAt).toBe("2026-09-03T11:00:00Z");
    expect(nuevo).toBe("2026-09-03T12:00:00Z");
  });
});

function primerArgUpdate(): { data: { subtotal: number; moneda: string } } {
  const calls = muts.updateCotizacion.mutateAsync.mock.calls as unknown as unknown[][];
  return calls[0][0] as { data: { subtotal: number; moneda: string } };
}

describe("savePaso3 (W-01: subtotal/moneda derivados de conceptos)", () => {
  it("USD: subtotal = suma de conceptos USD", async () => {
    await savePaso3({
      cotizacionId: "c1",
      conceptosVenta: [{ concepto: "A", moneda: "USD", total: 500 }],
      mutations: muts,
    });
    expect(muts.updateCotizacion.mutateAsync).toHaveBeenCalledWith({
      id: "c1",
      data: {
        conceptos_venta: [{ concepto: "A", moneda: "USD", total: 500 }],
        subtotal: 500,
        moneda: "USD",
      },
    });
  });

  it("MXN-only: subtotal en pesos y moneda MXN (antes quedaba en 0)", async () => {
    await savePaso3({
      cotizacionId: "c1",
      conceptosVenta: [{ concepto: "Flete", moneda: "MXN", total: 12000 }],
      mutations: muts,
    });
    const arg = primerArgUpdate();
    expect(arg.data.subtotal).toBe(12000);
    expect(arg.data.moneda).toBe("MXN");
  });

  it("mixta: se bloquea en lugar de persistir la bolsa mayor (P1-A)", async () => {
    await expect(
      savePaso3({
        cotizacionId: "c1",
        conceptosVenta: [
          { moneda: "USD", total: 100 },
          { moneda: "MXN", total: 5000 },
        ],
        mutations: muts,
      }),
    ).rejects.toThrow(MSG_COTIZACION_MIXTA);
  });
});


describe("savePasoFinal", () => {
  const registrar = vi.fn();
  beforeEach(() => registrar.mockClear());

  it("modo create: cambia estado a Borrador y registra 'crear'", async () => {
    await savePasoFinal({
      cotizacionId: "c1", isEditMode: false,
      mutations: muts, registrarActividad: registrar,
    });
    expect(muts.updateCotizacion.mutateAsync).toHaveBeenCalledWith({
      id: "c1", data: { estado: "Borrador" },
    });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: "crear", modulo: "cotizaciones" }));
  });

  it("modo edit: NO cambia estado pero registra 'editar'", async () => {
    await savePasoFinal({
      cotizacionId: "c1", isEditMode: true,
      mutations: muts, registrarActividad: registrar,
    });
    expect(muts.updateCotizacion.mutateAsync).not.toHaveBeenCalled();
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: "editar" }));
  });
});

// P1-A (13.823.70): el subtotal/moneda del encabezado no puede mezclar bolsas.
describe("derivarSubtotalMoneda (P1-A)", () => {
  it("MXN-only conserva subtotal y moneda MXN", () => {
    expect(
      derivarSubtotalMoneda([{ moneda: "MXN", total: 10000 }, { moneda: "MXN", total: 500 }]),
    ).toEqual({ subtotal: 10500, moneda: "MXN" });
  });

  it("USD-only conserva subtotal y moneda USD", () => {
    expect(derivarSubtotalMoneda([{ moneda: "USD", total: 4000 }])).toEqual({
      subtotal: 4000,
      moneda: "USD",
    });
  });

  it("mixto nominalmente engañoso (4,000 USD + 10,000 MXN) no persiste importe falso", () => {
    expect(() =>
      derivarSubtotalMoneda([{ moneda: "USD", total: 4000 }, { moneda: "MXN", total: 10000 }]),
    ).toThrow(MSG_COTIZACION_MIXTA);
  });

  it("empate nominal también se bloquea", () => {
    expect(() =>
      derivarSubtotalMoneda([{ moneda: "USD", total: 5000 }, { moneda: "MXN", total: 5000 }]),
    ).toThrow(MSG_COTIZACION_MIXTA);
  });
});

describe("savePaso3 (P1-A)", () => {
  it("no llama a la BD cuando la cotización es mixta", async () => {
    const mutateAsync = vi.fn();
    await expect(
      savePaso3({
        cotizacionId: "cot-1",
        conceptosVenta: [{ moneda: "USD", total: 100 }, { moneda: "MXN", total: 100 }],
        mutations: { updateCotizacion: { mutateAsync } } as never,
      }),
    ).rejects.toThrow(MSG_COTIZACION_MIXTA);
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
