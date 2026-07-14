import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const formState = {
  destinatarios: [{ email: "a@b.com" }],
  ccEmails: ["yo@x.com"],
  asunto: "Asunto inicial",
  mensaje: "",
  marcarEnviada: false,
  contactos: [],
  loadingContactos: false,
  seleccionados: {},
  setSeleccionados: vi.fn(),
  emailManual: "",
  setEmailManual: vi.fn(),
  emailsManualesAgregados: [],
  agregarManual: vi.fn(),
  pushManual: vi.fn(),
  quitarManual: vi.fn(),
  userEmail: "yo@x.com",
  ccManual: "",
  setCcManual: vi.fn(),
  setAsunto: vi.fn(),
  setMensaje: vi.fn(),
  setMarcarEnviada: vi.fn(),
};

vi.mock("@/hooks/emails/useEnvioDocumentoForm", () => ({
  useEnvioDocumentoForm: () => formState,
  EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
}));

vi.mock("@/components/shared/emails/DestinatariosPicker", () => ({
  DestinatariosPicker: () => <div data-testid="destinatarios-picker" />,
}));

import { EnviarDocumentoDialog } from "../EnviarDocumentoDialog";

describe("EnviarDocumentoDialog", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    clienteId: "cl-1",
    titulo: "Enviar factura",
    buildAsuntoInicial: () => "Asunto inicial",
    onEnviar: vi.fn(),
  };

  it("renderiza título y botones", () => {
    render(<EnviarDocumentoDialog {...baseProps} />);
    expect(screen.getByText("Enviar factura")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar/ })).toBeEnabled();
    expect(screen.getByTestId("destinatarios-picker")).toBeInTheDocument();
  });

  it("botón Enviar llama onEnviar con payload", async () => {
    const onEnviar = vi.fn();
    render(<EnviarDocumentoDialog {...baseProps} onEnviar={onEnviar} />);
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    expect(onEnviar).toHaveBeenCalledTimes(1);
    const [payload] = onEnviar.mock.calls[0];
    expect(payload.asunto).toBe("Asunto inicial");
    expect(payload.destinatarios).toHaveLength(1);
  });

  it("Cancelar cierra el dialog", () => {
    const onOpenChange = vi.fn();
    render(<EnviarDocumentoDialog {...baseProps} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("muestra 'Reenviar' cuando esReenvio=true", () => {
    render(<EnviarDocumentoDialog {...baseProps} esReenvio />);
    expect(screen.getByRole("button", { name: /Reenviar/ })).toBeInTheDocument();
  });

  it("muestra toggle 'marcar como enviada' cuando mostrarMarcarEnviada", () => {
    render(<EnviarDocumentoDialog {...baseProps} mostrarMarcarEnviada />);
    expect(screen.getByText(/Marcar el documento/)).toBeInTheDocument();
  });
});
