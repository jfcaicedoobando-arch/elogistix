/**
 * v13.624.1 — El formulario de "Editar Cliente" sólo debe reiniciarse al abrir
 * el modal. Si llega un refetch del cliente con el modal abierto, lo editado
 * NO se debe perder (antes provocaba el "parpadeo" de los interruptores).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DialogEditarCliente from "../DialogEditarCliente";

vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({ canConfigurarAutorizacionCliente: true }),
}));

const base = {
  nombre: "ACME",
  rfc: "AAA010101AAA",
  direccion: "",
  ciudad: "",
  estado: "",
  cp: "",
  contacto: "",
  email: "",
  telefono: "",
  regimen_fiscal: "601",
  uso_cfdi_default: "G03",
  dias_credito: 30,
  limite_credito_mxn: null,
  sin_comision: false,
  requiere_autorizacion_cotizacion: false,
  requiere_autorizacion_proforma: false,
};

describe("DialogEditarCliente | reinicio del formulario", () => {
  it("01 — conserva los valores cuando llega un refetch con el modal abierto", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <DialogEditarCliente
        open
        onOpenChange={() => {}}
        cliente={base}
        onSave={onSave}
        isSaving={false}
      />,
    );

    // Simula un refetch: nuevo objeto con los flags anteriores (encendidos).
    rerender(
      <DialogEditarCliente
        open
        onOpenChange={() => {}}
        cliente={{
          ...base,
          requiere_autorizacion_cotizacion: true,
          requiere_autorizacion_proforma: true,
        }}
        onSave={onSave}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        requiere_autorizacion_cotizacion: false,
        requiere_autorizacion_proforma: false,
      }),
    );
  });
});
