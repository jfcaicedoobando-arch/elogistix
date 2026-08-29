/**
 * useValidarLimiteCredito — helper para validar el límite de crédito del cliente
 * antes de emitir una proforma o factura.
 *
 * Fase 3 · Perfil de crédito como single source of truth.
 *
 * Uso típico:
 * ```ts
 * const validar = useValidarLimiteCredito();
 * const resultado = await validar({ clienteId, montoAdicionalMxn: total });
 * if (resultado?.rebasa) { setDialog(resultado); return; }
 * // continuar…
 * ```
 */
import { useCallback } from "react";
import {
  fetchExposicionCreditoCliente,
  type ExposicionCreditoCliente,
} from "@/features/cliente/services/crud";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface ValidarLimiteInput {
  clienteId: string;
  clienteNombre?: string | null;
  montoAdicionalMxn: number;
}

export interface ValidarLimiteResultado {
  exposicion: ExposicionCreditoCliente;
  totalProyectadoMxn: number;
  excedentePotencialMxn: number;
  /** true si al sumar el monto adicional se rebasa el límite (o ya estaba rebasado). */
  rebasa: boolean;
}

export function useValidarLimiteCredito() {
  return useCallback(
    async (input: ValidarLimiteInput): Promise<ValidarLimiteResultado | null> => {
      const exposicion = await fetchExposicionCreditoCliente(input.clienteId);
      if (!exposicion || exposicion.limiteMxn == null) return null;

      const montoAdicional = Math.max(0, Number(input.montoAdicionalMxn) || 0);
      const total = exposicion.enUsoMxn + montoAdicional;
      const excedente = Math.max(0, total - exposicion.limiteMxn);
      const rebasa = total > exposicion.limiteMxn;

      return {
        exposicion,
        totalProyectadoMxn: total,
        excedentePotencialMxn: excedente,
        rebasa,
      };
    },
    [],
  );
}

/**
 * M-15 (v14-2): fail-closed con override por rol. Exceder el límite de
 * crédito deja de ser un "confirm" universal: sólo gerencia y finanzas
 * pueden autorizar la excepción; el resto de roles queda bloqueado.
 */
const ROLES_OVERRIDE_CREDITO: ReadonlySet<string> = new Set([
  "super_admin",
  "admin",
  "admin_org",
  "contador",
  "tesorero",
  "gerente_operaciones",
  "gerente_comercial",
]);

export function puedeExcederCredito(rol: string | null | undefined): boolean {
  return !!rol && ROLES_OVERRIDE_CREDITO.has(rol);
}

/** Registra en bitácora que el operador continuó a pesar del exceso de crédito. */
export async function registrarExcesoCredito(params: {
  clienteId: string;
  clienteNombre?: string | null;
  totalProyectadoMxn: number;
  limiteMxn: number;
  excedenteMxn: number;
  origen: "proforma_convertir" | "factura_manual" | "otro";
}) {
  await registrarActividad({
    modulo: "facturacion",
    accion: "excede_credito",
    entidadId: params.clienteId,
    entidadNombre: params.clienteNombre ?? "",
    detalles: {
      origen: params.origen,
      total_proyectado_mxn: params.totalProyectadoMxn,
      limite_mxn: params.limiteMxn,
      excedente_mxn: params.excedenteMxn,
    },
  });
}
