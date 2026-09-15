/**
 * Regresión v13.823.397 — un Coordinador Logístico no podía generar la proforma
 * de su propio embarque (caso ELIMP00405): la base de datos sí lo autoriza
 * (`roles_jerarquia('operador')` incluye `coordinador_logistico` y
 * `gerente_operaciones`, usado por las policies de `proformas` y por
 * `_assert_writer`), pero la matriz de UI los omitía y ocultaba el botón.
 *
 * Este test fija el espejo UI↔RLS y confirma que no se amplió a ventas ni a
 * roles sin escritura operativa.
 */
import { describe, it, expect } from "vitest";
import { PROFORMAS_ESCRITURA, hasRole, FINANCE_VIEWERS } from "@/lib/access/permissionMatrix";
import type { AppRole } from "@/types/appRole";

describe("PROFORMAS_ESCRITURA · roles operativos", () => {
  const conEscritura: AppRole[] = ["coordinador_logistico", "gerente_operaciones", "operador"];

  it.each(conEscritura)("%s puede escribir proformas (espejo de RLS)", (rol) => {
    expect(hasRole(PROFORMAS_ESCRITURA, rol)).toBe(true);
  });

  const sinEscritura: AppRole[] = [
    "vendedor",
    "gerente_comercial",
    "viewer",
    "customer_service",
    "tesorero",
    "auxiliar_contable",
    "ejecutivo_cobranza",
    "ejecutivo_pricing",
    "cliente",
    "agente_carga",
  ];

  it.each(sinEscritura)("%s NO puede escribir proformas", (rol) => {
    expect(hasRole(PROFORMAS_ESCRITURA, rol)).toBe(false);
  });

  it("sin rol nunca hay escritura", () => {
    expect(hasRole(PROFORMAS_ESCRITURA, null)).toBe(false);
  });

  it("B1 intacto: el coordinador logístico no gana visibilidad financiera", () => {
    expect(FINANCE_VIEWERS).not.toContain("coordinador_logistico");
  });
});
