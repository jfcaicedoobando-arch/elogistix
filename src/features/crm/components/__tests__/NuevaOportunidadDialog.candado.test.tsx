/**
 * Hallazgo CRM 1280x720: en "Nueva oportunidad" el botón "Crear oportunidad"
 * quedaba habilitado sin origen ni Nombre y el clic no producía nada visible.
 * Ahora queda bloqueado con aviso accesible hasta tener origen + nombre.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import { EMPTY_OPORTUNIDAD } from "@/features/crm/domain/oportunidadFormState";
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";

const mutateAsync = vi.fn(async () => ({ id: "op-1" }));
let formActual: OportunidadFormState = EMPTY_OPORTUNIDAD;

vi.mock("@/features/crm/hooks", () => ({
  useCrearOportunidad: () => ({ mutateAsync, isPending: false }),
  useActualizarOportunidad: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCrearActividad: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEtapasPipeline: () => ({ data: [{ id: "e-ab", nombre: "Prospección", probabilidad_default: 20, tipo: "abierta" }] }),
  useOportunidadForm: () => ({
    form: formActual,
    setForm: vi.fn(),
    set: vi.fn(),
    isDirty: false,
    markClean: vi.fn(),
  }),
}));
vi.mock("@/features/cliente/hooks", () => ({ useClientesForSelect: () => ({ data: [] }) }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-1", email: "kam@acme.com" } }) }));
vi.mock("@/features/crm/components/nuevaOportunidad/OportunidadFormFields", () => ({ default: () => <div /> }));

const boton = () => screen.getByRole("button", { name: /Crear oportunidad/i }) as HTMLButtonElement;

describe("NuevaOportunidadDialog — candado de creación", () => {
  beforeEach(() => mutateAsync.mockClear());

  it("origen prospecto sin prospecto ni nombre: bloquea y avisa", () => {
    formActual = { ...EMPTY_OPORTUNIDAD, origen_tipo: "prospecto", etapa_id: "e-ab" };
    render(<NuevaOportunidadDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toMatch(/prospecto de origen/i);
    expect(boton().disabled).toBe(true);
    fireEvent.click(boton());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("origen cliente sin cliente: bloquea y avisa", () => {
    formActual = { ...EMPTY_OPORTUNIDAD, origen_tipo: "cliente", etapa_id: "e-ab", nombre: "Oportunidad Acme" };
    render(<NuevaOportunidadDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toMatch(/cliente de origen/i);
    expect(boton().disabled).toBe(true);
  });

  it("con prospecto y nombre se habilita sin aviso", () => {
    formActual = {
      ...EMPTY_OPORTUNIDAD,
      origen_tipo: "prospecto",
      etapa_id: "e-ab",
      lead_id: "l-1",
      nombre: "Oportunidad Acme",
    };
    render(<NuevaOportunidadDialog open onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(boton().disabled).toBe(false);
  });

  it("con cliente y nombre se habilita sin aviso", () => {
    formActual = {
      ...EMPTY_OPORTUNIDAD,
      origen_tipo: "cliente",
      etapa_id: "e-ab",
      cliente_id: "c-1",
      nombre: "Oportunidad Acme",
    };
    render(<NuevaOportunidadDialog open onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(boton().disabled).toBe(false);
  });
});
