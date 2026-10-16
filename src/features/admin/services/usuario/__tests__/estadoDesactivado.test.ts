import { describe, it, expect } from "vitest";
import { derivarEstado } from "../listado";

const base = { id: "u", email: "a@b.mx", created_at: "2026-01-01", last_sign_in_at: "2026-02-01" };
const ahora = Date.parse("2026-10-14T00:00:00Z");

describe("estado de cuenta desactivada", () => {
  it("bloqueo vigente se muestra como desactivado", () => {
    expect(derivarEstado({ ...base, banned_until: "2126-10-14T00:00:00Z" }, ahora)).toBe("desactivado");
  });
  it("bloqueo vencido o reactivado vuelve a activo", () => {
    expect(derivarEstado({ ...base, banned_until: "2026-01-01T00:00:00Z" }, ahora)).toBe("activo");
    expect(derivarEstado({ ...base, banned_until: null }, ahora)).toBe("activo");
  });
});
