/**
 * Regresión — coherencia entre el progreso del Perfil ICP y el gate
 * Lead→Prospecto: ambos usan la misma lista de campos mínimos.
 */
import { describe, it, expect } from "vitest";
import { completitudIcp, CAMPOS_MINIMOS_ICP, type LeadIcpSource } from "../icp";
import { CAMPOS_GATE_PROSPECTO, faltantesGateProspecto } from "../etapas";

const COMPLETO: LeadIcpSource = {
  sector: "Automotriz",
  mercancia: "Autopartes",
  rutas: "Shanghai–Manzanillo",
  volumen: "2 contenedores",
  frecuencia: "Mensual",
  dolor_explicito: "Retrasos en aduana",
  proveedor_actual: "Otro agente",
};

describe("progreso ICP vs gate de prospecto", () => {
  it("comparte la misma fuente de requisitos", () => {
    expect([...CAMPOS_GATE_PROSPECTO]).toEqual([...CAMPOS_MINIMOS_ICP]);
  });

  it("100% de completitud implica gate sin faltantes", () => {
    expect(completitudIcp(COMPLETO)).toBe(1);
    expect(faltantesGateProspecto(COMPLETO)).toEqual([]);
  });

  it("sin proveedor actual no llega a 100% y el gate lo reporta", () => {
    const sinProveedor = { ...COMPLETO, proveedor_actual: null };
    expect(completitudIcp(sinProveedor)).toBeLessThan(1);
    expect(faltantesGateProspecto(sinProveedor)).toEqual(["Proveedor actual"]);
  });
});
