import { act, renderHook } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { buildOportunidadFormPayload } from
  "@/features/crm/domain/oportunidadFormPayload";
import type { OportunidadQuickDraft } from "../useQuickCreateOportunidad";
import { useOportunidadForm } from "../useOportunidadForm";

const ETAPAS = [
  { id: "e-ab", tipo: "abierta", probabilidad_default: 20 },
  { id: "e-neg", tipo: "abierta", probabilidad_default: 60 },
];
const USER = {
  id: "u-captura",
  email: "captura@example.test",
} as User;

const BASE: OportunidadQuickDraft = {
  nombre: "Importación China Q1",
  empresa: { id: "empresa-1", nombre: "Acme" },
  origen: {
    tipo: "prospecto",
    id: "lead-1",
    nombre: "Acme",
    vendedorId: "u-dueno",
    vendedorEmail: "dueno@example.test",
  },
  etapaId: "e-neg",
  valorEstimado: "1500",
};

interface HookProps {
  open: boolean;
  draft: OportunidadQuickDraft | null;
}

function montar(draft: OportunidadQuickDraft | null = BASE) {
  return renderHook(
    ({ open, draft: actual }: HookProps) => useOportunidadForm(
      open,
      null,
      ETAPAS,
      USER,
      {
        nombre: actual?.nombre,
        empresa: actual?.empresa,
        origen: actual?.origen,
        etapaId: actual?.etapaId,
        valorEstimado: actual?.valorEstimado,
      },
    ),
    { initialProps: { open: true, draft } },
  );
}

describe("useOportunidadForm · borrador express y payload reales", () => {
  it.each([
    { texto: "", monto: 0, persistido: null },
    { texto: "0", monto: 0, persistido: null },
    { texto: "1500", monto: 1500, persistido: 1500 },
    { texto: "1500.25", monto: 1500.25, persistido: 1500.25 },
    { texto: "0.01", monto: 0.01, persistido: 0.01 },
  ])("transporta '$texto' al abrir Más campos y construir el payload", ({
    texto,
    monto,
    persistido,
  }) => {
    const draft = { ...BASE, valorEstimado: texto };
    const { result } = montar(draft);

    const comprobar = () => {
      expect(result.current.form).toMatchObject({
        nombre: "Importación China Q1",
        empresa_id: "empresa-1",
        empresa_nombre: "Acme",
        origen_tipo: "prospecto",
        lead_id: "lead-1",
        lead_nombre: "Acme",
        etapa_id: "e-neg",
        probabilidad: 60,
        vendedor_id: "u-dueno",
        vendedor_email: "dueno@example.test",
        moneda: "MXN",
        monto_meta: monto,
      });
      expect(buildOportunidadFormPayload(result.current.form, false))
        .toMatchObject({
          nombre: "Importación China Q1",
          empresa_id: "empresa-1",
          lead_id: "lead-1",
          cliente_id: null,
          etapa_id: "e-neg",
          probabilidad: 60,
          vendedor_id: "u-dueno",
          vendedor_email: "dueno@example.test",
          moneda: "MXN",
          monto_meta: persistido,
        });
      expect(result.current.isDirty).toBe(false);
    };

    comprobar();
  });

  it("al cerrar con borrador limpio, reabrir no arrastra la captura anterior", () => {
    const { result, rerender } = montar();
    expect(result.current.form.monto_meta).toBe(1500);

    rerender({ open: false, draft: null });
    rerender({ open: true, draft: null });

    expect(result.current.form).toMatchObject({
      nombre: "",
      empresa_id: null,
      empresa_nombre: "",
      origen_tipo: "prospecto",
      lead_id: null,
      lead_nombre: "",
      cliente_id: null,
      cliente_nombre: "",
      etapa_id: "e-ab",
      probabilidad: 20,
      vendedor_id: "u-captura",
      vendedor_email: "captura@example.test",
      moneda: "MXN",
      monto_meta: 0,
    });
    expect(buildOportunidadFormPayload(result.current.form, false))
      .toMatchObject({
        nombre: "", empresa_id: null, lead_id: null, cliente_id: null, monto_meta: null,
      });
    expect(result.current.isDirty).toBe(false);
  });

  it("objetos equivalentes en un render no borran otros campos editados", () => {
    const { result, rerender } = montar();

    act(() => { result.current.set("notas", "Nota capturada en Más campos"); });

    rerender({
      open: true,
      draft: {
        ...BASE,
        empresa: { ...BASE.empresa! },
        origen: { ...BASE.origen! },
      },
    });

    expect(result.current.form.notas).toBe("Nota capturada en Más campos");
    expect(result.current.form.monto_meta).toBe(1500);
    expect(result.current.isDirty).toBe(true);
  });

  it("actualiza el importe precapturado cuando cambia con la misma identidad", () => {
    const { result, rerender } = montar();

    rerender({
      open: true,
      draft: { ...BASE, valorEstimado: "900.25" },
    });

    expect(result.current.form.monto_meta).toBe(900.25);
    expect(result.current.isDirty).toBe(false);
  });

  it("una apertura posterior recibe el nuevo borrador completo", () => {
    const { result, rerender } = montar();
    rerender({ open: false, draft: null });

    const nuevo: OportunidadQuickDraft = {
      nombre: "Proyecto nuevo",
      empresa: { id: "empresa-2", nombre: "Beta" },
      origen: { tipo: "cliente", id: "cliente-2", nombre: "Beta" },
      etapaId: "e-ab",
      valorEstimado: "25.50",
    };
    rerender({ open: true, draft: nuevo });

    expect(result.current.form).toMatchObject({
      nombre: "Proyecto nuevo",
      empresa_id: "empresa-2",
      empresa_nombre: "Beta",
      origen_tipo: "cliente",
      cliente_id: "cliente-2",
      cliente_nombre: "Beta",
      lead_id: null,
      etapa_id: "e-ab",
      probabilidad: 20,
      vendedor_id: "u-captura",
      vendedor_email: "captura@example.test",
      monto_meta: 25.5,
    });
    expect(buildOportunidadFormPayload(result.current.form, false))
      .toMatchObject({
        nombre: "Proyecto nuevo",
        empresa_id: "empresa-2",
        cliente_id: "cliente-2",
        lead_id: null,
        monto_meta: 25.5,
        moneda: "MXN",
      });
    expect(result.current.isDirty).toBe(false);
  });
});
