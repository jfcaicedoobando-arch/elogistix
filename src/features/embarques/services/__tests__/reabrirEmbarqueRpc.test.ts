/**
 * v13.356.0 — la reapertura Cerrado → Entregado era bloqueada por el trigger
 * `trg_embarque_transicion_valida`. Este test cubre:
 *   1. Contrato SQL: la migración activa y desactiva `app.bypass_transicion`.
 *   2. Mapeo de mensaje: `LC_TRANSICION_INVALIDA` produce un texto de
 *      reapertura y no el genérico "cambió en otra sesión".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { reabrirEmbarqueRpc } from "../embarqueEstadoRpc";

function readMigrationContaining(needle: string): string {
  const dir = path.resolve(__dirname, "../../../../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    if (sql.includes(needle)) return sql;
  }
  throw new Error(`No se encontró migración con "${needle}"`);
}

describe("reabrir_embarque — contrato SQL", () => {
  const sql = readMigrationContaining("app.bypass_transicion','on'");

  it("activa y desactiva el bypass del validador de transiciones", () => {
    expect(sql).toMatch(/FUNCTION public\.reabrir_embarque/);
    expect(sql).toMatch(/set_config\('app\.bypass_transicion','on', true\)/);
    expect(sql).toMatch(/set_config\('app\.bypass_transicion','off', true\)/);
  });

  it("conserva las validaciones de rol, motivo y estado", () => {
    expect(sql).toMatch(/Solo administradores pueden reabrir/);
    expect(sql).toMatch(/mínimo 20 caracteres/);
    expect(sql).toMatch(/Solo embarques en estado Cerrado pueden reabrirse/);
    expect(sql).toMatch(/_assert_writer/);
  });

  it("mantiene REVOKE + GRANT EXECUTE explícitos (H6)", () => {
    // v13.380.3 — los grants pueden vivir en una migración correctiva posterior
    // (FIX-H6-05), por eso se busca el archivo que los contiene.
    const grants = readMigrationContaining("REVOKE ALL ON FUNCTION public.reabrir_embarque");
    expect(grants).toMatch(/REVOKE ALL ON FUNCTION public\.reabrir_embarque/);
    expect(grants).toMatch(/GRANT EXECUTE ON FUNCTION public\.reabrir_embarque\(uuid, text, text, uuid\) TO authenticated/);
  });

});

describe("reabrirEmbarqueRpc — mapeo de errores", () => {
  beforeEach(() => rpcMock.mockReset());

  const input = { embarqueId: "e-1", usuarioEmail: "a@b.com", motivo: "x".repeat(25) };

  it("traduce LC_TRANSICION_INVALIDA a un mensaje de reapertura", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: "LC_TRANSICION_INVALIDA: no se permite pasar de Cerrado a Entregado",
        code: "P0001",
      },
    });
    await expect(reabrirEmbarqueRpc(input)).rejects.toThrow(/reapertura \(Cerrado → Entregado\)/);
  });

  it("no altera otros errores", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Embarque no encontrado", code: "P0001" },
    });
    await expect(reabrirEmbarqueRpc(input)).rejects.toThrow(/Embarque no encontrado/);
  });

  it("resuelve sin error en el happy path", async () => {
    rpcMock.mockResolvedValue({ data: { estado: "Entregado" }, error: null });
    await expect(reabrirEmbarqueRpc(input)).resolves.toEqual({ replay: false, pendiente: false });
  });
});
