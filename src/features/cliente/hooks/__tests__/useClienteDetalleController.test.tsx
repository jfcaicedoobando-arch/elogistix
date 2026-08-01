import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useClienteDetalleController } from "../useClienteDetalleController";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
  useParams: vi.fn(() => ({ id: "client-1" })),
}));

vi.mock("@/features/cliente/hooks/useClientes", () => ({
  useCliente: vi.fn(() => ({ data: { id: "client-1", nombre: "Client One" }, isLoading: false })),
  useContactosCliente: vi.fn(() => ({ data: [], isLoading: false })),
  useEmbarquesCliente: vi.fn(() => ({ data: [], isLoading: false })),
  useCotizacionesCliente: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateContacto: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateContacto: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteContacto: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateCliente: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock("@/features/cliente/hooks/useClienteFinancials", () => ({
  useClienteFinancials: vi.fn(() => ({ data: null })),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
  usePermissions: vi.fn(() => ({ canEdit: true })),
  useRegistrarActividad: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import { notifySuccess } from "@/lib/ui/appFeedback";
import { useUpdateCliente } from "@/features/cliente/hooks/useClientes";

describe("useClienteDetalleController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the contact dialog for a new contact", () => {
    const { result } = renderHook(() => useClienteDetalleController(), { wrapper: createWrapper() });

    act(() => {
      result.current.openNewContact();
    });

    expect(result.current.contactDialogOpen).toBe(true);
    expect(result.current.editingContacto).toBeNull();
  });

  it("handles saving a client with audit logs", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdateCliente).mockReturnValue({ mutateAsync, isPending: false } as never);
    const { result } = renderHook(() => useClienteDetalleController(), { wrapper: createWrapper() });

    const formData = {
      nombre: "Client One Updated",
      rfc: "RFC123",
      direccion: "Dir",
      ciudad: "City",
      estado: "State",
      cp: "123",
      contacto: "Cont",
      email: "email@test.com",
      telefono: "123",
      regimen_fiscal: "601",
      uso_cfdi_default: "G03",
      dias_credito: null,
      limite_credito_mxn: null,
      sin_comision: false,
    };

    await act(async () => {
      await result.current.handleSaveCliente(formData);
    });

    expect(mutateAsync).toHaveBeenCalled();
    expect(result.current.editClienteOpen).toBe(false);
    expect(notifySuccess).toHaveBeenCalled();
  });
});
