import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DialogContacto from "../DialogContacto";
import type { Tables } from "@/types/db";

type ContactoCliente = Tables<"contactos_cliente">;

describe("DialogContacto — columnas NOT NULL", () => {
  it("envía cadenas vacías (nunca null) cuando sólo se captura el nombre", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <DialogContacto
        open
        onOpenChange={() => {}}
        contacto={null}
        onSave={onSave}
        isSaving={false}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Nombre/i), {
      target: { value: "  Acme  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Agregar/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [payload, editingId] = onSave.mock.calls[0];
    expect(editingId).toBeNull();
    expect(payload.nombre).toBe("Acme");
    for (const campo of [
      "rfc",
      "pais",
      "ciudad",
      "direccion",
      "contacto",
      "email",
      "telefono",
    ] as const) {
      expect(payload[campo]).toBe("");
    }
  });

  it("normaliza valores nulos de una fila legacy al editar", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const legacy = {
      id: "c1",
      nombre: "Legacy",
      tipo: "Exportador",
      rfc: null,
      pais: null,
      ciudad: null,
      direccion: null,
      contacto: null,
      email: null,
      telefono: null,
    } as unknown as ContactoCliente;

    render(
      <DialogContacto
        open
        onOpenChange={() => {}}
        contacto={legacy}
        onSave={onSave}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Legacy", email: "", telefono: "" }),
      "c1",
    );
  });
});
