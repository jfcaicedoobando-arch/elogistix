import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useNuevoProveedorController } from "../useNuevoProveedorController";

describe("useNuevoProveedorController", () => {
  it("validates step 1 and moves to step 2", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() => useNuevoProveedorController(onSave, onClose));
    
    act(() => {
      result.current.setField("categoria", "Logistico");
      result.current.setField("tipo", "Naviera");
      result.current.setField("nombre", "Prov A");
      result.current.setField("origen_proveedor", "Nacional");
      result.current.setField("rfc", "RFC123");
    });
    
    expect(result.current.isStep1Valid).toBe(true);
    
    act(() => {
      result.current.handleNext();
    });
    
    expect(result.current.step).toBe(2);
    expect(result.current.documentos).toHaveLength(7); // DOCS_NACIONAL length
  });

  it("resets and closes", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNuevoProveedorController(vi.fn(), onClose));
    
    act(() => {
      result.current.resetAndClose();
    });
    
    expect(onClose).toHaveBeenCalled();
    expect(result.current.step).toBe(1);
  });
});
