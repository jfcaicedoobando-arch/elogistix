import { describe, it, expect, vi, beforeEach } from "vitest";

const crearActividad = vi.fn();
vi.mock("@/features/crm/services/actividades", () => ({
  crearActividad: (...args: unknown[]) => crearActividad(...args),
}));

import {
  registrarContactoAutomatico,
  fechaSeguimientoContacto,
  DIAS_SEGUIMIENTO_CONTACTO,
} from "../autoRegistroContacto";

describe("autoRegistroContacto", () => {
  beforeEach(() => {
    crearActividad.mockReset();
    crearActividad.mockResolvedValue({ id: "a-1" });
  });

  it("registra la actividad de email con el asunto de la plantilla", async () => {
    await registrarContactoAutomatico(
      { canal: "email", entidadTipo: "lead", entidadId: "l-1", plantilla: "Primer contacto", destino: "a@b.mx" },
      { id: "u-1", email: "v@lc.mx" },
    );
    expect(crearActividad).toHaveBeenCalledTimes(1);
    const [input] = crearActividad.mock.calls[0];
    expect(input).toMatchObject({
      tipo: "email",
      entidad_tipo: "lead",
      entidad_id: "l-1",
    });
    expect(input.asunto).toContain("Primer contacto");
  });

  it("usa tipo llamada para WhatsApp", async () => {
    await registrarContactoAutomatico(
      { canal: "whatsapp", entidadTipo: "oportunidad", entidadId: "o-1", plantilla: "Seguimiento", destino: "5255" },
      null,
    );
    expect(crearActividad.mock.calls[0][0].tipo).toBe("llamada");
  });

  it("no propaga errores: el mensaje del vendedor nunca se bloquea", async () => {
    crearActividad.mockRejectedValue(new Error("boom"));
    await expect(
      registrarContactoAutomatico(
        { canal: "email", entidadTipo: "lead", entidadId: "l-1", plantilla: "X", destino: "a@b.mx" },
        null,
      ),
    ).resolves.toBeUndefined();
  });

  it("agenda el seguimiento a los días definidos", () => {
    const iso = fechaSeguimientoContacto(new Date("2026-08-21T00:00:00Z"));
    const dias = (new Date(iso).getTime() - new Date("2026-08-21T00:00:00Z").getTime()) / 86400000;
    expect(dias).toBe(DIAS_SEGUIMIENTO_CONTACTO);
  });
});
