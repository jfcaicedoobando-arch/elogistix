import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { from, limit, mutate } = vi.hoisted(() => ({ from: vi.fn(), limit: vi.fn(), mutate: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/features/crm/hooks/useObjetosCrm", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/crm/hooks/useObjetosCrm")>(),
  useVinculoCrm: () => ({ mutate, isPending: false }),
}));
vi.mock("../BuscadorObjetoCrm", () => ({ BuscadorObjetoCrm: () => <button>Ligar empresa</button> }));
import { VinculosCard } from "../VinculosCard";
import type { Relacion } from "@/features/crm/hooks/useObjetosCrm";

const escenarios = [
  { relacion: "empresas-de-contacto", tipo: "empresa-contacto", par: (id: string) => ({ aId: id, bId: "dueno" }) },
  { relacion: "empresas-de-oportunidad", tipo: "oportunidad-empresa", par: (id: string) => ({ aId: "dueno", bId: id }) },
] as const;
const filas = [
  { crm_empresas: { id: "activa", nombre: "Empresa vigente", deleted_at: null } },
  { crm_empresas: { id: "eliminada", nombre: "Nombre histórico", deleted_at: "2026-10-16T10:00:00Z" } },
  { crm_empresas: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  const consulta = { select: vi.fn(), eq: vi.fn(), limit };
  consulta.select.mockReturnValue(consulta);
  consulta.eq.mockReturnValue(consulta);
  from.mockReturnValue(consulta);
  limit.mockResolvedValue({ data: filas, error: null });
});

function show(escenario: typeof escenarios[number] = escenarios[0], canEdit = true, conEdicion = true, relacion: Relacion = escenario.relacion) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const rutaBase = relacion === "contactos-de-empresa" ? "/crm/contactos" : "/crm/empresas";
  return render(<QueryClientProvider client={client}><MemoryRouter>
    <VinculosCard titulo="Empresas" relacion={relacion} duenoId="dueno" rutaBase={rutaBase}
      canEdit={canEdit} edicion={conEdicion ? { tipo: escenario.tipo, par: escenario.par, objeto: "empresa" } : undefined} />
  </MemoryRouter></QueryClientProvider>);
}

describe.each(escenarios)("VinculosCard: $relacion", (escenario) => {
  it("mantiene el enlace activo y muestra el nombre histórico con etiqueta y sin anchor", async () => {
    show(escenario);
    expect(await screen.findByRole("link", { name: "Empresa vigente" })).toHaveAttribute("href", "/crm/empresas/activa");
    const nombre = screen.getByText("Nombre histórico");
    const fila = nombre.closest("li")!;
    expect(nombre.closest("a")).toBeNull();
    expect(within(fila).queryByRole("link")).not.toBeInTheDocument();
    expect(within(fila).getByText("Empresa eliminada")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Empresas (2)")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(within(fila).getByRole("button", { name: "Quitar vínculo con Nombre histórico" }));
    expect(mutate).toHaveBeenCalledExactlyOnceWith({ tipo: escenario.tipo, ...escenario.par("eliminada"), quitar: true });
  });

  it.each([
    { canEdit: false, conEdicion: true },
    { canEdit: true, conEdicion: false },
  ])("no ofrece unlink sin permiso y configuración: %j", async ({ canEdit, conEdicion }) => {
    show(escenario, canEdit, conEdicion);
    await screen.findByText("Nombre histórico");
    expect(screen.queryByRole("button", { name: /Quitar vínculo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ligar empresa" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Empresa vigente" })).toHaveAttribute("href", "/crm/empresas/activa");
    expect(screen.getByText("Empresa eliminada")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("no revela nombres, estados ni controles cuando RLS devuelve únicamente embeds nulos", async () => {
    limit.mockResolvedValue({ data: [{ crm_empresas: null }], error: null });
    show(escenario, false);
    expect(await screen.findByText("Sin registros ligados.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Empresa eliminada")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });
});

it("conserva la navegación de contactos sin ampliar la etiqueta a otros objetos", async () => {
  limit.mockResolvedValue({ data: [{ crm_contactos: { id: "contacto", nombre: "Contacto" } }], error: null });
  show(escenarios[0], false, false, "contactos-de-empresa");
  expect(await screen.findByRole("link", { name: "Contacto" })).toHaveAttribute("href", "/crm/contactos/contacto");
  expect(screen.queryByText("Empresa eliminada")).not.toBeInTheDocument();
});
