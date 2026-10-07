import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FacturaCxP } from "@/features/cxp/services";
import type { useAprobarFactura } from "@/features/cxp/hooks/useAprobarFactura";
import { AprobarRechazarDialogs } from "../DialogDetallePagosProveedor.aprobardialogs";

const titulo = "Aprobar factura sin embarque en datos generales";
const descripcion = "FP14 — Esta factura no tiene un embarque seleccionado en sus datos generales. "
  + "Revisa los conceptos vinculados antes de aprobar. "
  + "Escribe para qué fue el gasto: la justificación queda guardada en la factura y en la bitácora. "
  + "El límite autorizado para gastos directos aplica sólo si tampoco hay conceptos de costo vinculados.";

function setup(embarqueId: string | null = null) {
  const confirmar = vi.fn().mockResolvedValue(undefined);
  const cerrar = vi.fn();
  const aprobar = { mutateAsync: confirmar, isPending: false } as unknown as ReturnType<typeof useAprobarFactura>;
  const factura = { id: "f1", embarque_id: embarqueId, updated_at: "v1", folio_interno: "FP14", proveedor_nombre: "Maniobras" } as FacturaCxP;
  const props = { f: factura, openAprobar: true, openRechazar: false, setOpenAprobar: cerrar,
    setOpenRechazar: vi.fn(), aprobar, ctxLabel: "FP14" };
  const view = render(<AprobarRechazarDialogs {...props} />);
  return { confirmar, cerrar, props, ...view };
}

describe("copy de aprobación según el embarque de cabecera", () => {
  it("cabecera NULL describe sólo datos generales y condiciona el límite a los conceptos de costo", () => {
    setup();
    expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument();
    expect(screen.getByText(descripcion)).toBeInTheDocument();
    expect(screen.queryByText(/no está ligada a un embarque ni a costos acordados/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tendrás que vincularla al embarque/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprobar factura" })).toBeDisabled();
  });

  it("conserva el mínimo de 10 caracteres y envía la justificación recortada", async () => {
    const { confirmar, cerrar } = setup();
    const motivo = screen.getByRole("textbox", { name: /Justificación del gasto/ });
    const boton = screen.getByRole("button", { name: "Aprobar factura" });
    fireEvent.change(motivo, { target: { value: " 123456789 " } });
    expect(boton).toBeDisabled();
    fireEvent.change(motivo, { target: { value: " 1234567890 " } });
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith({ id: "f1", aprobar: true,
      motivo: "1234567890", expectedUpdatedAt: "v1", folio: "FP14", proveedor: "Maniobras" }));
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith(false));
  });

  it("mantiene deshabilitada la confirmación pendiente aunque el motivo sea válido", () => {
    const { props, rerender, confirmar } = setup();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gasto revisado" } });
    const pendiente = { mutateAsync: confirmar, isPending: true } as unknown as ReturnType<typeof useAprobarFactura>;
    rerender(<AprobarRechazarDialogs {...props} aprobar={pendiente} />);
    fireEvent.click(screen.getByRole("button", { name: "Procesando…" }));
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("cabecera presente conserva la confirmación normal sin justificación", async () => {
    const { confirmar } = setup("e1");
    expect(screen.getByRole("heading", { name: "Aprobar factura" })).toBeInTheDocument();
    expect(screen.getByText(/Al aprobar, la factura pasará a estado/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(descripcion)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí, aprobar" }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({
      expectedUpdatedAt: "v1", motivo: undefined, aprobar: true,
    })));
  });

  it("refetch conserva copy, motivo y versión revisados; el conflicto no cierra el modal", async () => {
    const { confirmar, cerrar, props, rerender } = setup();
    confirmar.mockRejectedValue(new Error("LC_CONFLICTO_CONCURRENCIA"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Conceptos revisados" } });
    rerender(<AprobarRechazarDialogs {...props} f={{ ...props.f, embarque_id: "e2", updated_at: "v2" }} />);
    expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument();
    expect(screen.getByText(descripcion)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Conceptos revisados");
    fireEvent.click(screen.getByRole("button", { name: "Aprobar factura" }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({
      expectedUpdatedAt: "v1", motivo: "Conceptos revisados",
    })));
    expect(cerrar).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument();
    rerender(<AprobarRechazarDialogs {...props} openAprobar={false} />);
    rerender(<AprobarRechazarDialogs {...props} f={{ ...props.f, embarque_id: "e2", updated_at: "v2" }} />);
    expect(screen.getByRole("button", { name: "Sí, aprobar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí, aprobar" }));
    await waitFor(() => expect(confirmar).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: "v2" })));
  });
});
