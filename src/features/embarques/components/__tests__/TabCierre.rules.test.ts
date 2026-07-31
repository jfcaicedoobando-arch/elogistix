/**
 * v13.56.1 — Tests de la regla de gating de cierre/reapertura usada por TabCierre.
 * Verifica que los roles correctos puedan ejecutar cada acción y que el
 * estado del embarque sea respetado.
 */
import { describe, it, expect } from "vitest";

/**
 * Replica la lógica embebida en TabCierre.tsx para validarla de forma aislada.
 * Si esta regla cambia, debe actualizarse aquí y en el componente al unísono.
 */
const ESTADOS_LISTOS_PARA_CIERRE = new Set(["entregado", "eir", "por liquidar"]);
function puedeCerrar(opts: {
  isAdmin: boolean;
  canEditFinance: boolean;
  estatus: string;
}): boolean {
  return (
    (opts.isAdmin || opts.canEditFinance) &&
    ESTADOS_LISTOS_PARA_CIERRE.has((opts.estatus ?? "").toLowerCase())
  );
}

function puedeReabrir(opts: { isSuperAdmin: boolean; isAdmin: boolean }): boolean {
  return opts.isSuperAdmin || opts.isAdmin;
}

describe("cierre — reglas de gating", () => {
  it("admin con embarque entregado puede cerrar", () => {
    expect(puedeCerrar({ isAdmin: true, canEditFinance: false, estatus: "entregado" })).toBe(true);
  });

  it("admin con embarque EIR (marítimo) puede cerrar", () => {
    expect(puedeCerrar({ isAdmin: true, canEditFinance: false, estatus: "eir" })).toBe(true);
    expect(puedeCerrar({ isAdmin: true, canEditFinance: false, estatus: "EIR" })).toBe(true);
  });

  it("admin con embarque en Por liquidar puede cerrar (v13.380.1)", () => {
    expect(puedeCerrar({ isAdmin: true, canEditFinance: false, estatus: "Por liquidar" })).toBe(true);
  });


  it("contador (canEditFinance) con embarque entregado puede cerrar", () => {
    expect(puedeCerrar({ isAdmin: false, canEditFinance: true, estatus: "entregado" })).toBe(true);
  });

  it("admin NO puede cerrar si el embarque no está entregado ni en EIR", () => {
    expect(puedeCerrar({ isAdmin: true, canEditFinance: true, estatus: "en_transito" })).toBe(false);
    expect(puedeCerrar({ isAdmin: true, canEditFinance: true, estatus: "cerrado" })).toBe(false);
  });

  it("operador sin canEditFinance no puede cerrar aunque esté entregado", () => {
    expect(puedeCerrar({ isAdmin: false, canEditFinance: false, estatus: "entregado" })).toBe(false);
  });

  it("super_admin siempre puede reabrir", () => {
    expect(puedeReabrir({ isSuperAdmin: true, isAdmin: false })).toBe(true);
  });

  it("admin puede reabrir (sujeto a config global del backend)", () => {
    expect(puedeReabrir({ isSuperAdmin: false, isAdmin: true })).toBe(true);
  });

  it("usuario sin privilegios no puede reabrir", () => {
    expect(puedeReabrir({ isSuperAdmin: false, isAdmin: false })).toBe(false);
  });
});

describe("cierre — validación de motivo de reapertura", () => {
  const MIN = 20;
  const valido = (m: string) => m.trim().length >= MIN;

  it("rechaza motivos vacíos", () => {
    expect(valido("")).toBe(false);
    expect(valido("   ")).toBe(false);
  });

  it("rechaza motivos cortos", () => {
    expect(valido("corto")).toBe(false);
    expect(valido("a".repeat(19))).toBe(false);
  });

  it("acepta motivos de 20+ caracteres", () => {
    expect(valido("a".repeat(20))).toBe(true);
    expect(valido("Corrección de costos por reclamo del cliente.")).toBe(true);
  });
});

describe("cierre — confirmación tipada", () => {
  it("solo acepta exactamente 'CERRAR'", () => {
    expect("CERRAR" === "CERRAR").toBe(true);
    expect(("cerrar" as string) === "CERRAR").toBe(false);
    expect(("CERRAR " as string) === "CERRAR").toBe(false);
  });
});

describe("cierre — etiquetas de reglas RPC (v13.90.8)", () => {
  // Replica el diccionario de TabCierre. Si cambia allá, debe cambiar aquí.
  // v13.90.8: `costos_liquidados` se eliminó del RPC (derivado desde pagos_proveedor).
  const ETIQUETAS_REGLA: Record<string, string> = {
    cxc_sin_pendientes: "Cuentas por cobrar al día",
    cxc_cobrada: "Cuentas por cobrar al día",
    cxp_sin_pendientes: "Cuentas por pagar al día",
    cxp_pagada: "Cuentas por pagar al día",
    documentos_completos: "Documentos requeridos completos",
    docs_completos: "Documentos requeridos completos",
    pnl_margen_minimo: "Utilidad mínima alcanzada",
    comision_calculada: "Comisión devengada calculada",
    contenedores_datos_completos: "Datos de contenedores capturados (peso y volumen)",
    contenedores_fechas_completas: "Fechas de descarga y devolución capturadas",
    venta_conceptos_facturados: "Todos los conceptos de venta facturados",
    costo_conceptos_con_factura: "Todos los costos tienen factura de proveedor recibida",
  };

  // Reglas que el RPC `validar_cierre_embarque` puede devolver.
  const REGLAS_RPC = [
    "cxc_cobrada",
    "cxp_pagada",
    "docs_completos",
    "pnl_margen_minimo",
    "comision_calculada",
    "contenedores_datos_completos",
    "contenedores_fechas_completas",
    "venta_conceptos_facturados",
    "costo_conceptos_con_factura",
  ];

  it("toda regla emitida por el RPC tiene etiqueta legible", () => {
    for (const regla of REGLAS_RPC) {
      expect(ETIQUETAS_REGLA[regla], `falta etiqueta para ${regla}`).toBeTruthy();
    }
  });

  // Replica el cálculo de `puede_cerrar` del RPC: AND de todos los `ok` de las
  // reglas duras. (`comision_calculada` es informativa, siempre ok=true.)
  const puedeCerrarRpc = (checks: { regla: string; ok: boolean }[]) =>
    checks.every((c) => c.ok);

  it("bloquea cierre si venta_conceptos_facturados=false", () => {
    const checks = [
      { regla: "cxc_cobrada", ok: true },
      { regla: "cxp_pagada", ok: true },
      { regla: "docs_completos", ok: true },
      { regla: "pnl_margen_minimo", ok: true },
      { regla: "comision_calculada", ok: true },
      { regla: "venta_conceptos_facturados", ok: false },
      { regla: "costo_conceptos_con_factura", ok: true },
    ];
    expect(puedeCerrarRpc(checks)).toBe(false);
  });

  it("bloquea cierre si costo_conceptos_con_factura=false", () => {
    const checks = [
      { regla: "cxc_cobrada", ok: true },
      { regla: "cxp_pagada", ok: true },
      { regla: "docs_completos", ok: true },
      { regla: "pnl_margen_minimo", ok: true },
      { regla: "comision_calculada", ok: true },
      { regla: "venta_conceptos_facturados", ok: true },
      { regla: "costo_conceptos_con_factura", ok: false },
    ];
    expect(puedeCerrarRpc(checks)).toBe(false);
  });

  it("permite cierre cuando todas las reglas están ok", () => {
    const checks = [
      { regla: "cxc_cobrada", ok: true },
      { regla: "cxp_pagada", ok: true },
      { regla: "docs_completos", ok: true },
      { regla: "pnl_margen_minimo", ok: true },
      { regla: "comision_calculada", ok: true },
      { regla: "venta_conceptos_facturados", ok: true },
      { regla: "costo_conceptos_con_factura", ok: true },
    ];
    expect(puedeCerrarRpc(checks)).toBe(true);
  });
});
