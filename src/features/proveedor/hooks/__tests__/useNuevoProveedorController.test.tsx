/**
 * Tests del controller `useNuevoProveedorController`.
 * Cubre: validación step 1, transiciones de categoría, handlers de tipo/subtipo,
 * documentos por origen, RFC duplicado debounced, handleSave (CLABE inválida,
 * happy path, ProveedorDuplicadoError), reset/close y CSF upload (patch merge).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const findProveedorByRfcEnOrg = vi.fn();
const procesarCsfUpload = vi.fn();
const notifyError = vi.fn();

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/features/proveedor/services", () => {
  class ProveedorDuplicadoError extends Error {
    existente: { id: string; nombre: string };
    constructor(existente: { id: string; nombre: string }) {
      super("dup");
      this.existente = existente;
    }
  }
  return {
    findProveedorByRfcEnOrg: (...a: unknown[]) => findProveedorByRfcEnOrg(...a),
    ProveedorDuplicadoError,
  };
});

vi.mock("@/hooks/shared", () => ({
  useOrgFilter: () => ({ organizationId: "org-1" }),
}));

vi.mock("../useNuevoProveedorController.csf", () => ({
  procesarCsfUpload: (...a: unknown[]) => procesarCsfUpload(...a),
  mergeCsfPatch: (prev: Record<string, unknown>, patch: Record<string, unknown>) => ({
    ...prev,
    ...patch,
  }),
}));

vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
}));

import { ProveedorDuplicadoError } from "@/features/proveedor/services";
import { useNuevoProveedorController } from "../useNuevoProveedorController";

const fillStep1Logistico = (result: { current: ReturnType<typeof useNuevoProveedorController> }) => {
  act(() => {
    result.current.handleCategoriaChange("Logistico");
  });
  act(() => {
    result.current.setField("nombre", "Prov A");
    result.current.setField("origen_proveedor", "Nacional");
    result.current.setField("rfc", "RFC123456789");
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  findProveedorByRfcEnOrg.mockResolvedValue(null);
});

describe("useNuevoProveedorController — validación step 1", () => {
  it("invalida cuando faltan campos requeridos", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    expect(result.current.isStep1Valid).toBe(false);
  });

  it("valida logístico nacional con nombre + rfc + tipo (default Naviera)", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    fillStep1Logistico(result);
    expect(result.current.isStep1Valid).toBe(true);
    expect(result.current.isLogistico).toBe(true);
    expect(result.current.rfcLabel).toBe("RFC");
  });

  it("Agente de Carga requiere país", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    fillStep1Logistico(result);
    act(() => result.current.handleTipoChange("Agente de Carga"));
    expect(result.current.isAgenteCarga).toBe(true);
    expect(result.current.isStep1Valid).toBe(false);
    act(() => result.current.setField("pais", "MX"));
    expect(result.current.isStep1Valid).toBe(true);
  });

  it("Gasto Operativo fuerza Nacional + MXN y requiere subtipo", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    act(() => result.current.handleCategoriaChange("GastoOperativo"));
    expect(result.current.isGasto).toBe(true);
    expect(result.current.form.origen_proveedor).toBe("Nacional");
    expect(result.current.form.moneda_preferida).toBe("MXN");
    expect(result.current.form.subtipo_gasto).toBe("Otros");
    act(() => {
      result.current.setField("nombre", "Gasto X");
      result.current.setField("rfc", "RFC999");
    });
    expect(result.current.isStep1Valid).toBe(true);
    act(() => result.current.handleSubtipoGastoChange("Combustible"));
    expect(result.current.form.subtipo_gasto).toBe("Combustible");
  });

  it("origen Extranjero cambia rfcLabel a Tax ID", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    fillStep1Logistico(result);
    act(() => result.current.setField("origen_proveedor", "Extranjero"));
    expect(result.current.rfcLabel).toBe("Tax ID");
  });
});

describe("useNuevoProveedorController — handleNext y documentos", () => {
  it("no avanza si step 1 inválido", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    act(() => result.current.handleNext());
    expect(result.current.step).toBe(1);
    expect(result.current.documentos).toHaveLength(0);
  });

  it("avanza y carga 7 documentos nacionales", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    fillStep1Logistico(result);
    act(() => result.current.handleNext());
    expect(result.current.step).toBe(2);
    expect(result.current.documentos).toHaveLength(7);
  });

  it("carga documentos de extranjero (6) cuando origen es Extranjero", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    fillStep1Logistico(result);
    act(() => result.current.setField("origen_proveedor", "Extranjero"));
    act(() => result.current.handleNext());
    expect(result.current.documentos).toHaveLength(6);
  });

  it("handleFileChange marca documento como adjuntado", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    fillStep1Logistico(result);
    act(() => result.current.handleNext());
    const docNombre = result.current.documentos[0].nombre;
    const file = new File(["x"], "cif.pdf", { type: "application/pdf" });
    act(() => result.current.handleFileChange(docNombre, file));
    const doc = result.current.documentos.find((d) => d.nombre === docNombre);
    expect(doc?.adjuntado).toBe(true);
    expect(doc?.archivo).toBe("cif.pdf");
  });
});

describe("useNuevoProveedorController — RFC duplicado debounced", () => {
  it("consulta duplicado tras 300ms y setea rfcDuplicado", async () => {
    vi.useFakeTimers();
    findProveedorByRfcEnOrg.mockResolvedValue({ id: "pv-9", nombre: "Existente" });
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    act(() => result.current.setField("rfc", "RFCDUP"));
    await act(async () => {
      vi.advanceTimersByTime(310);
    });
    vi.useRealTimers();
    await waitFor(() => expect(result.current.rfcDuplicado).toEqual({ id: "pv-9", nombre: "Existente" }));
  });

  it("limpia rfcDuplicado cuando rfc queda vacío", () => {
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    act(() => result.current.setField("rfc", ""));
    expect(result.current.rfcDuplicado).toBeNull();
  });
});

describe("useNuevoProveedorController — handleSave", () => {
  it("rechaza CLABE con menos de 18 dígitos", async () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useNuevoProveedorController(onSave, vi.fn()));
    fillStep1Logistico(result);
    act(() => result.current.setField("clabe", "123"));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(notifyError).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("happy path: persiste, resetea y cierra", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { result } = renderHook(() => useNuevoProveedorController(onSave, onClose));
    fillStep1Logistico(result);
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(result.current.step).toBe(1);
    expect(result.current.form.nombre).toBe("");
  });

  it("ProveedorDuplicadoError mantiene el diálogo abierto", async () => {
    const onSave = vi.fn().mockRejectedValue(new ProveedorDuplicadoError({ id: "pv-x", nombre: "Dup" }, "RFC123456789"));
    const onClose = vi.fn();
    const { result } = renderHook(() => useNuevoProveedorController(onSave, onClose));
    fillStep1Logistico(result);
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
  });
});

describe("useNuevoProveedorController — CSF upload y reset", () => {
  it("aplica patch del CSF cuando procesarCsfUpload devuelve datos", async () => {
    procesarCsfUpload.mockResolvedValue({ rfc: "CSF010101AAA", nombre: "Razón Social SA" });
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    const file = new File(["x"], "csf.pdf");
    await act(async () => {
      await result.current.handleCsfUpload(file);
    });
    expect(result.current.form.rfc).toBe("CSF010101AAA");
    expect(result.current.form.nombre).toBe("Razón Social SA");
    expect(result.current.csfLoading).toBe(false);
  });

  it("no aplica patch si procesarCsfUpload devuelve null", async () => {
    procesarCsfUpload.mockResolvedValue(null);
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), vi.fn()));
    await act(async () => {
      await result.current.handleCsfUpload(new File([], "csf.pdf"));
    });
    expect(result.current.form.rfc).toBe("");
  });

  it("resetAndClose limpia estado y notifica al parent", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), onClose));
    fillStep1Logistico(result);
    act(() => result.current.resetAndClose());
    expect(onClose).toHaveBeenCalled();
    expect(result.current.step).toBe(1);
    expect(result.current.form.nombre).toBe("");
  });
});
