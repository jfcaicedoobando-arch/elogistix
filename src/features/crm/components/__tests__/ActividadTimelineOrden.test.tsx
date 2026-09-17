/**
 * CRM-P2.7 — el timeline muestra la fecha de CREACIÓN de cada actividad, así
 * que debe pedirla ordenada por `created_at` descendente. Antes heredaba el
 * orden por `fecha_programada` de la agenda y la cronología salía revuelta,
 * sobre todo con notas (sin fecha programada) mezcladas con tareas.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ActividadTimeline from "@/features/crm/components/ActividadTimeline";

const filtrosUsados: Record<string, unknown>[] = [];

const ACTIVIDADES = [
  {
    id: "a3", tipo: "nota", asunto: "Nota más reciente",
    descripcion: "", created_at: "2026-06-18T15:00:00Z",
    fecha_programada: null, completada: false,
  },
  {
    id: "a2", tipo: "tarea", asunto: "Tarea intermedia",
    descripcion: "", created_at: "2026-06-16T15:00:00Z",
    fecha_programada: "2026-07-30T15:00:00Z", completada: false,
  },
  {
    id: "a1", tipo: "llamada", asunto: "Llamada más antigua",
    descripcion: "", created_at: "2026-06-10T15:00:00Z",
    fecha_programada: "2026-06-11T15:00:00Z", completada: false,
  },
];

vi.mock("@/features/crm/hooks", () => ({
  ACTIVIDAD_TIPOS: ["llamada", "email", "reunion", "tarea", "nota"],
  useActividades: (f: Record<string, unknown>) => {
    filtrosUsados.push(f);
    return { data: { data: ACTIVIDADES }, isError: false, refetch: vi.fn() };
  },
  useCrearActividad: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCompletarActividad: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({ canCrearActividad: true, canGestionarActividad: () => true }),
}));

describe("ActividadTimeline · orden cronológico", () => {
  it("pide el listado ordenado por fecha de creación descendente", () => {
    render(<ActividadTimeline entidadTipo="lead" entidadId="lead-1" />);
    expect(filtrosUsados.at(-1)).toMatchObject({
      sortKey: "created_at",
      sortDir: "desc",
    });
  });

  it("muestra tareas y notas en el mismo orden que recibe (más reciente arriba)", () => {
    render(<ActividadTimeline entidadTipo="lead" entidadId="lead-1" />);
    const textos = screen
      .getAllByText(/Nota más reciente|Tarea intermedia|Llamada más antigua/)
      .map((n) => n.textContent);
    expect(textos).toEqual([
      "Nota más reciente",
      "Tarea intermedia",
      "Llamada más antigua",
    ]);
  });
});
