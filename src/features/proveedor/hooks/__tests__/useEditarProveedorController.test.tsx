import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useEditarProveedorController } from "../useEditarProveedorController";

const mockProveedor: any = {
  id: "1",
  nombre: "Old Name",
  tipo: "Naviera",
  rfc: "RFC1",
  origen_proveedor: "Nacional",
  email: "old@test.com",
};

describe("useEditarProveedorController", () => {
  it("validates form fields", () => {
    const { result } = renderHook(() => useEditarProveedorController(mockProveedor, true, vi.fn(), vi.fn()));
    
    act(() => {
      result.current.setField("email", "invalid-email");
      result.current.markTouched("email");
    });
    
    expect(result.current.isValid).toBe(false);
    expect(result.current.fieldErrorMessage("email")).toBe("Correo inválido.");
  });

  it("handles saving when valid", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useEditarProveedorController(mockProveedor, true, onSave, vi.fn()));
    
    act(() => {
      result.current.setField("nombre", "New Name");
    });
    
    act(() => {
      result.current.handleSave();
    });
    
    expect(onSave).toHaveBeenCalledWith(
      "1",
      expect.objectContaining({ nombre: "New Name" }),
      undefined,
      undefined,
    );
  });
});
