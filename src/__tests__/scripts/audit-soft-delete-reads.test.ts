import { describe, it, expect } from "vitest";
import { claveDe, lecturaProtegida, ventanaConsulta, type Hallazgo } from "../../../scripts/audit-soft-delete-reads";

function hallazgo(archivo: string, tabla = "clientes"): Hallazgo {
  return { archivo, tabla, linea: 12, tipo: "puntual" };
}

describe("identidad portable de lecturas con borrado lógico", () => {
  it("la misma lectura Windows/Linux corresponde a la misma entrada histórica", () => {
    const linux = "src/features/facturacion/services/datosFiscalesCliente.ts";
    const windows = "src\\features\\facturacion\\services\\datosFiscalesCliente.ts";
    const baseline = new Set([`${linux}::clientes`]);
    expect(baseline.has(claveDe(hallazgo(windows)))).toBe(true);
    expect(claveDe(hallazgo(windows))).toBe(claveDe(hallazgo(linux)));
  });
  it("separadores mixtos se normalizan, archivos y tablas diferentes conservan su identidad", () => {
    expect(claveDe(hallazgo("src/features\\cliente/services/crud.ts"))).toBe("src/features/cliente/services/crud.ts::clientes");
    expect(claveDe(hallazgo("src/features/cliente/services/crud.ts", "contactos_cliente"))).not.toBe(claveDe(hallazgo("src/features/cliente/services/crud.ts")));
    expect(claveDe(hallazgo("src/features/cliente/services/contactos.ts"))).not.toBe(claveDe(hallazgo("src/features/cliente/services/crud.ts")));
  });
  it("una ruta nueva sigue siendo fuga y una deuda ausente sigue siendo obsoleta", () => {
    const deuda = "src/features/cliente/services/crud.ts::clientes";
    const baseline = new Set([deuda]);
    const actuales = [hallazgo("src\\features\\cliente\\services\\nuevo.ts")].map(claveDe);
    expect(actuales.filter((key) => !baseline.has(key))).toEqual(["src/features/cliente/services/nuevo.ts::clientes"]);
    expect([...baseline].filter((key) => !actuales.includes(key))).toEqual([deuda]);
  });
  it("normalizar la clave no convierte una lectura sin filtro en lectura protegida", () => {
    const consulta = 'supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle();';
    expect(lecturaProtegida(ventanaConsulta(consulta, consulta.indexOf(".from(")))).toBe(false);
    const protegida = 'supabase.from("clientes").select("id").is("deleted_at", null).maybeSingle();';
    expect(lecturaProtegida(ventanaConsulta(protegida, protegida.indexOf(".from(")))).toBe(true);
  });
});
