import { beforeEach, describe, expect, it, vi } from "vitest";
import { leerCorreos } from "../leerCorreos";
import type { CorreoTarifas } from "@/features/costeo/services/extraerTarifasCorreo";
import type { FilaCorreo } from "../comun";

const mocks = vi.hoisted(() => ({ extraer: vi.fn(), agentes: vi.fn(), parser: vi.fn() }));
vi.mock("@/features/costeo/services/extraerTarifasCorreo", () => ({ extraerTarifasCorreo: mocks.extraer }));
vi.mock("@/features/costeo/services/importacionTarifasCorreo", () => ({ fetchAgentesImportacionCorreo: mocks.agentes }));
vi.mock("../parsearCorreoTarifas", () => ({ parsearCorreoProveedor: mocks.parser }));
vi.mock("@/lib/date/mx", () => ({ hoyMx: () => "2026-10-14" }));

const correo: CorreoTarifas = {
  proveedor: "longsail", asunto: "Tarifas sintéticas", fecha: "2026-10-14",
  textoPlano: "Contenido sintético", xlsxBase64: null, xlsxNombre: null,
};
const fila: FilaCorreo = {
  Origen: "Shanghai", Destino: "Manzanillo", Agente: "Nombre original", Naviera: "MAEU",
  "Tarifa 20": 100, "Tarifa 40": 200, "Inicio de la vigencia": "2026-10-14",
  "Término de la vigencia": "2026-10-31", "Días libres": 21, Observaciones: "Sintética",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.extraer.mockResolvedValue([correo]);
  mocks.agentes.mockResolvedValue([{ id: "ag-1", nombre: "Lóngsail México" }]);
  mocks.parser.mockResolvedValue({ filas: [fila], errores: [] });
});

describe("leerCorreos", () => {
  it("usa el servicio validado y conserva la organización para los agentes", async () => {
    await expect(leerCorreos("org-a")).resolves.toEqual({
      filas: [{ ...fila, Agente: "Lóngsail México" }], errores: [], resumen: [{ proveedor: "Longsail", filas: 1 }],
    });
    expect(mocks.extraer).toHaveBeenCalledExactlyOnceWith("org-a");
    expect(mocks.agentes).toHaveBeenCalledExactlyOnceWith("org-a");
    expect(mocks.parser).toHaveBeenCalledExactlyOnceWith(correo, "2026-10-14");
  });

  it.each([new Error("fallo de servicio"), { message: "fallo de transporte" }])("propaga errores sin buscar agentes ni parsear", async (error) => {
    mocks.extraer.mockRejectedValue(error);
    await expect(leerCorreos("org-a")).rejects.toBe(error);
    expect(mocks.agentes).not.toHaveBeenCalled();
    expect(mocks.parser).not.toHaveBeenCalled();
  });

  it("propaga el fallo de catálogos antes del parser", async () => {
    const error = new Error("agentes no disponibles");
    mocks.agentes.mockRejectedValue(error);
    await expect(leerCorreos("org-a")).rejects.toBe(error);
    expect(mocks.parser).not.toHaveBeenCalled();
  });

  it("conserva los errores parciales por proveedor y el resumen", async () => {
    const otro: CorreoTarifas = { ...correo, proveedor: "golden", error: "Sin correos recientes" };
    mocks.extraer.mockResolvedValue([correo, otro]);
    mocks.parser.mockResolvedValueOnce({ filas: [fila], errores: ["Longsail: fila inválida"] });
    mocks.parser.mockResolvedValueOnce({ filas: [], errores: ["Golden: Sin correos recientes"] });
    await expect(leerCorreos("org-a")).resolves.toEqual({
      filas: [{ ...fila, Agente: "Lóngsail México" }], errores: ["Longsail: fila inválida", "Golden: Sin correos recientes"],
      resumen: [{ proveedor: "Longsail", filas: 1 }, { proveedor: "Golden", filas: 0 }],
    });
  });

  it("usa la clave del proveedor cuando no encuentra el agente", async () => {
    mocks.agentes.mockResolvedValue([]);
    expect((await leerCorreos("org-a")).filas[0].Agente).toBe("LONGSAIL");
  });

  it("devuelve un lote vacío válido sin parsear", async () => {
    mocks.extraer.mockResolvedValue([]);
    await expect(leerCorreos("org-a")).resolves.toEqual({ filas: [], errores: [], resumen: [] });
    expect(mocks.parser).not.toHaveBeenCalled();
  });
});
