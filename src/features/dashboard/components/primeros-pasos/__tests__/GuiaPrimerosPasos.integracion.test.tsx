import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import type { AppRole } from "@/types/appRole";

const contexto = vi.hoisted(() => ({
  auth: {
    user: { id: "persona-a" } as { id: string } | null,
    role: "vendedor" as AppRole | null,
    effectiveRole: "vendedor" as AppRole | null,
    loading: false, profileError: false, refreshProfile: vi.fn(async () => {}),
  },
  org: {
    organizationId: "empresa-a" as string | null,
    loading: false, errorOrganizaciones: false,
    reintentarCargaOrganizaciones: vi.fn(),
  },
}));

vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => contexto.auth }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => contexto.org }));

// usePermissions y el selector de dominio permanecen reales.
import { GuiaPrimerosPasos } from "../GuiaPrimerosPasos";
import { ContenidoPrimerosPasos } from "../ContenidoPrimerosPasos";
import Ayuda from "@/features/dashboard/routes/Ayuda";

function RutaActual() {
  const { pathname, search } = useLocation();
  return <div aria-label="Ruta actual">{pathname}{search}</div>;
}

function Vista({ ayuda = false }: { ayuda?: boolean }) {
  return <MemoryRouter initialEntries={[ayuda ? "/ayuda" : "/inicio"]}>
    {ayuda ? <Ayuda /> : <GuiaPrimerosPasos />}
    <RutaActual />
  </MemoryRouter>;
}

function abrirGuia() {
  fireEvent.click(screen.getByRole("button", { name: /Empieza por tu tarea|Ver guía de primeros pasos/ }));
}

function cambiarRol(role: AppRole | null) {
  contexto.auth.role = role;
  contexto.auth.effectiveRole = role;
}

beforeEach(() => {
  contexto.auth.user = { id: "persona-a" };
  cambiarRol("vendedor");
  contexto.auth.loading = false;
  contexto.auth.profileError = false;
  contexto.auth.refreshProfile.mockReset();
  contexto.auth.refreshProfile.mockResolvedValue();
  contexto.org.organizationId = "empresa-a";
  contexto.org.loading = false;
  contexto.org.errorOrganizaciones = false;
  contexto.org.reintentarCargaOrganizaciones.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("Guía contextual conectada a permisos reales", () => {
  it("cero tareas anuncia el estado sin ofrecer acciones ni reintentar", () => {
    const retry = vi.fn(async () => {});
    render(<ContenidoPrimerosPasos resultado={{ estado: "disponible", contexto: "organizacion", tareas: [] }} onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent("No hay tareas de esta guía disponibles para tu acceso actual.");
    expect(screen.getByRole("status")).toHaveTextContent("Consulta las preguntas frecuentes de los módulos que puedes abrir.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(retry).not.toHaveBeenCalled();
  });

  it("es opcional, expone su expansión y sólo navega al elegir un enlace", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<Vista />);
    const trigger = screen.getByRole("button", { name: "Empieza por tu tarea" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Preparar una cotización" })).not.toBeInTheDocument();
    abrirGuia();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Empieza por tu tarea" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preparar una cotización" }));
    expect(screen.getByRole("link", { name: "Abrir CRM" })).toHaveAttribute("href", "/crm");
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent("/inicio");
    fireEvent.click(trigger);
    abrirGuia();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(contexto.auth.refreshProfile).not.toHaveBeenCalled();
    expect(contexto.org.reintentarCargaOrganizaciones).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Preparar una cotización" }));
    fireEvent.click(screen.getByRole("link", { name: "Ver cotizaciones" }));
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent("/cotizaciones");
    storage.mockRestore();
  });

  it.each([
    ["vendedor", "Preparar una cotización", "Revisar pagos a proveedores"],
    ["contador", "Preparar la emisión de una factura", "Revisar pagos a proveedores"],
    ["tesorero", "Revisar pagos a proveedores", "Preparar la emisión de una factura"],
    ["customer_service", "Preparar una cotización", "Capturar facturas de proveedor"],
    ["gerente_visor", "Consultar información", "Preparar una cotización"],
  ] as const)("%s recibe tareas de su matriz específica", (role, visible, oculta) => {
    cambiarRol(role);
    render(<Vista />);
    abrirGuia();
    expect(screen.getByRole("button", { name: visible })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: oculta })).not.toBeInTheDocument();
    if (role === "customer_service") {
      fireEvent.click(screen.getByRole("button", { name: visible }));
      expect(screen.queryByRole("link", { name: "Abrir CRM" })).not.toBeInTheDocument();
    }
  });

  it("preserva los parámetros de las bandejas de emisión", () => {
    cambiarRol("contador");
    render(<Vista />);
    abrirGuia();
    fireEvent.click(screen.getByRole("button", { name: "Preparar la emisión de una factura" }));
    expect(screen.getByRole("link", { name: "Ver proformas aceptadas" })).toHaveAttribute("href", "/proformas?estado=aceptada");
    expect(screen.getByRole("link", { name: "Ver Por timbrar" })).toHaveAttribute("href", "/facturacion?bandeja=por-timbrar");
  });

  it.each(["usuario", "organizacion", "rol"])("cambio de %s descarta la apertura y la tarea anterior", (cambio) => {
    const { rerender } = render(<Vista />);
    abrirGuia();
    fireEvent.click(screen.getByRole("button", { name: "Preparar una cotización" }));
    if (cambio === "usuario") contexto.auth.user = { id: "persona-b" };
    if (cambio === "organizacion") contexto.org.organizationId = "empresa-b";
    if (cambio === "rol") cambiarRol("contador");
    rerender(<Vista />);
    expect(screen.getByRole("button", { name: "Empieza por tu tarea" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Ver cotizaciones" })).not.toBeInTheDocument();
    abrirGuia();
    expect(screen.queryByRole("link", { name: "Ver cotizaciones" })).not.toBeInTheDocument();
  });

  it.each([
    ["usuario", "dentro"], ["usuario", "fuera"],
    ["organizacion", "dentro"], ["organizacion", "fuera"],
    ["rol-global", "dentro"], ["rol-global", "fuera"],
    ["rol-efectivo", "dentro"], ["rol-efectivo", "fuera"],
  ] as const)("cambio de %s con foco %s sólo lo recupera cuando pertenecía a la guía", (cambio, foco) => {
    const vista = () => <><button type="button">Selector externo</button><Vista /></>;
    const { rerender } = render(vista());
    abrirGuia();
    fireEvent.click(screen.getByRole("button", { name: "Preparar una cotización" }));
    const externo = screen.getByRole("button", { name: "Selector externo" });
    const previo = foco === "dentro" ? screen.getByRole("link", { name: "Ver cotizaciones" }) : externo;
    previo.focus();
    expect(previo).toHaveFocus();
    if (cambio === "usuario") contexto.auth.user = { id: "persona-b" };
    if (cambio === "organizacion") contexto.org.organizationId = "empresa-b";
    if (cambio === "rol-global") contexto.auth.role = "cliente";
    if (cambio === "rol-efectivo") contexto.auth.effectiveRole = "contador";
    rerender(vista());
    const trigger = screen.getByRole("button", { name: "Empieza por tu tarea" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(foco === "dentro" ? trigger : externo).toHaveFocus();
    expect(screen.queryByRole("link", { name: "Ver cotizaciones" })).not.toBeInTheDocument();
  });

  it.each(["carga", "carga-organizaciones", "error-perfil", "error-organizaciones"])("%s oculta las tareas aunque conserva el rol anterior", (estado) => {
    const { rerender } = render(<Vista />);
    abrirGuia();
    fireEvent.click(screen.getByRole("button", { name: "Preparar una cotización" }));
    if (estado === "carga") contexto.auth.loading = true;
    if (estado === "carga-organizaciones") contexto.org.loading = true;
    if (estado === "error-perfil") contexto.auth.profileError = true;
    if (estado === "error-organizaciones") contexto.org.errorOrganizaciones = true;
    rerender(<Vista />);
    expect(screen.queryByRole("button", { name: "Preparar una cotización" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver cotizaciones" })).not.toBeInTheDocument();
    if (estado === "carga" || estado === "carga-organizaciones") expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    else expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar el contexto");
    contexto.auth.loading = false;
    contexto.org.loading = false;
    contexto.auth.profileError = false;
    contexto.org.errorOrganizaciones = false;
    rerender(<Vista />);
    expect(screen.getByRole("button", { name: "Empieza por tu tarea" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Preparar una cotización" })).toHaveAttribute("aria-expanded", "false");
  });

  it("reintenta el perfil existente y mantiene el panel abierto durante la espera", async () => {
    contexto.auth.profileError = true;
    let terminar: () => void = () => {};
    contexto.auth.refreshProfile.mockImplementation(() => new Promise<void>((resolve) => { terminar = resolve; }));
    const { rerender } = render(<Vista />);
    abrirGuia();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga de cuenta" }));
    expect(contexto.auth.refreshProfile).toHaveBeenCalledTimes(1);
    expect(contexto.org.reintentarCargaOrganizaciones).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    expect(screen.getByRole("button", { name: "Empieza por tu tarea" })).toHaveAttribute("aria-expanded", "true");
    contexto.auth.profileError = false;
    rerender(<Vista />);
    expect(screen.queryByRole("button", { name: "Preparar una cotización" })).not.toBeInTheDocument();
    await act(async () => terminar());
    await waitFor(() => expect(screen.getByRole("button", { name: "Preparar una cotización" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Empieza por tu tarea" })).toHaveAttribute("aria-expanded", "true");
  });

  it("reintenta la lista de organizaciones con su callback existente", () => {
    contexto.org.errorOrganizaciones = true;
    render(<Vista />);
    abrirGuia();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga de organizaciones" }));
    expect(contexto.org.reintentarCargaOrganizaciones).toHaveBeenCalledTimes(1);
    expect(contexto.auth.refreshProfile).not.toHaveBeenCalled();
  });

  it("reintentar desde su botón conserva el foco en el trigger al sustituir el contenido", async () => {
    contexto.auth.profileError = true;
    let terminar: () => void = () => {};
    contexto.auth.refreshProfile.mockImplementation(() => new Promise<void>((resolve) => { terminar = resolve; }));
    const { rerender } = render(<Vista />);
    abrirGuia();
    const retry = screen.getByRole("button", { name: "Reintentar carga de cuenta" });
    retry.focus();
    expect(retry).toHaveFocus();
    fireEvent.click(retry);
    const trigger = screen.getByRole("button", { name: "Empieza por tu tarea" });
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    contexto.auth.profileError = false;
    rerender(<Vista />);
    await act(async () => terminar());
    expect(screen.getByRole("button", { name: "Preparar una cotización" })).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("un retry pendiente de otra persona no retiene ni repone su panel", async () => {
    contexto.auth.profileError = true;
    let terminar: () => void = () => {};
    contexto.auth.refreshProfile.mockImplementation(() => new Promise<void>((resolve) => { terminar = resolve; }));
    const { rerender } = render(<Vista />);
    abrirGuia();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga de cuenta" }));
    contexto.auth.user = { id: "persona-b" };
    cambiarRol("tesorero");
    contexto.auth.profileError = false;
    rerender(<Vista />);
    expect(screen.getByRole("button", { name: "Empieza por tu tarea" })).toHaveAttribute("aria-expanded", "false");
    abrirGuia();
    expect(screen.getByRole("button", { name: "Revisar pagos a proveedores" })).toBeInTheDocument();
    await act(async () => terminar());
    expect(screen.getByRole("button", { name: "Revisar pagos a proveedores" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preparar una cotización" })).not.toBeInTheDocument();
  });

  it("resolver un retry en la misma identidad conserva el foco que ya está fuera", async () => {
    contexto.auth.profileError = true;
    let terminar: () => void = () => {};
    contexto.auth.refreshProfile.mockImplementation(() => new Promise<void>((resolve) => { terminar = resolve; }));
    const vista = () => <><button type="button">Selector externo</button><Vista /></>;
    const { rerender } = render(vista());
    abrirGuia();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga de cuenta" }));
    const externo = screen.getByRole("button", { name: "Selector externo" });
    externo.focus();
    contexto.auth.profileError = false;
    rerender(vista());
    await act(async () => terminar());
    expect(externo).toHaveFocus();
    expect(screen.getByRole("button", { name: "Empieza por tu tarea" })).toHaveAttribute("aria-expanded", "true");
  });

  it.each(["sin-rol", "sin-organizacion"])("%s explica el acceso y no muestra tareas", (estado) => {
    if (estado === "sin-rol") cambiarRol(null);
    else contexto.org.organizationId = null;
    render(<Vista />);
    abrirGuia();
    expect(screen.getByRole("status")).toHaveTextContent(estado === "sin-rol" ? "rol disponible" : "organización activa");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each(["cliente", "agente_carga"] as const)("%s usa el portal global aunque quede un rol interno anterior", (role) => {
    contexto.auth.role = role;
    contexto.auth.effectiveRole = "admin_org";
    contexto.org.organizationId = null;
    render(<Vista />);
    abrirGuia();
    fireEvent.click(screen.getByRole("button", { name: role === "cliente" ? "Consultar tu portal de cliente" : "Consultar tu portal de agente" }));
    const prefijo = role === "cliente" ? "/portal" : "/agente";
    for (const link of screen.getAllByRole("link")) expect(link.getAttribute("href")).toMatch(new RegExp(`^${prefijo}(?:/|$)`));
    expect(screen.queryByRole("button", { name: "Preparar una cotización" })).not.toBeInTheDocument();
  });

  it("super admin usa el ID activo; salir de empresa descarta tareas internas", () => {
    cambiarRol("super_admin");
    const { rerender } = render(<Vista />);
    abrirGuia();
    expect(screen.getByRole("button", { name: "Preparar una cotización" })).toBeInTheDocument();
    contexto.org.organizationId = null;
    rerender(<Vista />);
    abrirGuia();
    expect(screen.queryByRole("button", { name: "Preparar una cotización" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elegir el contexto de trabajo" }));
    expect(screen.getByRole("link", { name: "Abrir panel de plataforma" })).toHaveAttribute("href", "/admin");
  });

  it("Ayuda sin sesión mantiene FAQ y búsqueda, ofrece guía general y no redirige", () => {
    contexto.auth.user = null;
    // Ni siquiera un rol residual debe personalizar una visita anónima.
    cambiarRol("admin_org");
    render(<Vista ayuda />);
    expect(screen.getByRole("heading", { name: "Centro de ayuda" })).toBeInTheDocument();
    abrirGuia();
    expect(screen.getByRole("status")).toHaveTextContent("guía general");
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Preparar una cotización" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent("/ayuda");
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar término, pregunta o concepto" }), { target: { value: "sin coincidencia ficticia" } });
    expect(screen.getByText(/No hay resultados para/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver guía de primeros pasos" })).toBeInTheDocument();
  });
});
