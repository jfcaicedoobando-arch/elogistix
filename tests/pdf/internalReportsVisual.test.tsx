import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { EstadoCuentaProveedorDocument } from "@/pdf/documents/EstadoCuentaProveedorDocument";
import { EstadoCuentaBancarioDocument } from "@/pdf/documents/EstadoCuentaBancarioDocument";
import { LibroPagosDocument, type FilaLibroPagosExport } from "@/pdf/documents/LibroPagosDocument";
import { BitacoraTesoreriaDocument } from "@/pdf/documents/BitacoraTesoreriaDocument";
import { ReporteTesoreriaDocument } from "@/pdf/documents/ReporteTesoreriaDocument";
import { RentabilidadDocument } from "@/pdf/documents/RentabilidadDocument";
import { ReporteCarteraDocument } from "@/pdf/documents/ReporteCarteraDocument";
import { ReporteEERRDocument } from "@/pdf/documents/ReporteEERRDocument";
import { ReportePresupuestoDocument } from "@/pdf/documents/ReportePresupuestoDocument";
import { ReporteEjecutivoDocument } from "@/pdf/documents/ReporteEjecutivoDocument";
import { calcularResumenTesoreria, calcularFlujoProyectado } from "@/features/tesoreria/domain";
import { calcularVencimientosEjecutivos } from "@/features/dashboardEjecutivo/domain/vencimientos";
import { calcularKPIsEjecutivos } from "@/features/dashboardEjecutivo/services/alertas";
import { buildEstadoResultados } from "@/features/profit/domain/estadoResultados";
import type { ResumenVsReal } from "@/features/presupuesto/services";
import type { SnapshotEjecutivo } from "@/features/dashboardEjecutivo/services";
import { inspectPdf } from "./inspectPdf";
import { emisor } from "./fixtures";

const hoy = new Date("2026-10-06T12:00:00");
const cuentas = [
  { id: "mxn", alias: "Operación México", banco: "Banco sintético", moneda: "MXN", saldo: 1234567.89 },
  { id: "usd", alias: "Fletes aéreos", banco: "Banco sintético", moneda: "USD", saldo: 8750.45 },
];
const tesoreria = calcularResumenTesoreria({ cuentas, cobranza: [], cxp: [], hoy, tipoCambioUsd: 18.5 });
tesoreria.top_deudores = [{ nombre: "Deudor de Mérida", saldo: 1234567.89, moneda: "MXN", dias: 35 }];
tesoreria.top_acreedores = [{ nombre: "Acreedor de Querétaro", saldo: 8750.45, moneda: "USD", dias: 14 }];
const eerr = buildEstadoResultados(
  [{ id: "emb", modo: "Marítimo", tipo_cambio_usd: 18.5, tipo_cambio_eur: 21 }],
  [{ embarque_id: "emb", descripcion: "Flete marítimo México", total: 1234567.89, moneda: "MXN" }],
  [{ embarque_id: "emb", concepto: "Último costo aéreo", monto: 234567.89, moneda: "MXN" }],
);
eerr.notas_proveedor_sin_base = ["nota-sintetica"];
const presupuesto: ResumenVsReal = {
  periodo: "2026-10", filas: [{ categoria_id: "flete", categoria_nombre: "Última categoría logística", presupuesto_mxn: 1000000, real_mxn: 1234567.89, variacion_mxn: 234567.89, cumplimiento_pct: 123.456789 }],
  total_presupuesto_mxn: 1000000, total_real_mxn: 1234567.89, variacion_neta_mxn: 234567.89,
  categorias_en_exceso: 1, top_exceso: [], gastos_sin_tc_count: 0, real_truncado: false, notas_proveedor_sin_base_count: 1,
};
const baseEjecutivo = {
  periodo: "2026-10", fuente: "facturas" as const, eerrPeriodo: eerr, eerr12m: [], tesoreria, presupuesto,
  vencimientos: calcularVencimientosEjecutivos({ cobranza: [], cxp: [], hoy }),
  flujo: calcularFlujoProyectado({ cuentas, cobranza: [], cxp: [], liquidaciones: [], hoy, dias: 28 }),
  tipoCambioUsd: 18.5, tcEsFallback: true,
};
const ejecutivo: SnapshotEjecutivo = {
  ...baseEjecutivo, generadoEn: "2026-10-06T18:00:00Z", kpis: calcularKPIsEjecutivos(baseEjecutivo, 0),
  topDeudores: tesoreria.top_deudores, topAcreedores: tesoreria.top_acreedores,
  alertas: [{ id: "cobranza", severidad: "warning", titulo: "Última alerta", descripcion: "Revisión de cobranza en México", url: "/tesoreria" }],
};
const pago: FilaLibroPagosExport = {
  fecha: "06/10/2026", tipo: "Devolución de anticipo", contraparte: "Proveedor de Mérida", documento: "FP-65", metodo: "Transferencia",
  referencia: "Último pago", cuenta: "Operativa", monto: "USD 8,750.45", tipoCambio: "18.5000", fuenteTc: "Guardado", montoMxn: "MXN 161,883.33", estado: "Pendiente",
};
const resumenPagos = { periodo: "01/10/2026 - 06/10/2026", cobrado: "MXN 1,234,567.89", pagado: "MXN 161,883.33", devuelto: "MXN 0.03", neto: "MXN 1,072,684.56", conteo: "1" };
const rentabilidadKpis = { total_venta_usd: 1234567.89, total_costo_usd: 234567.89, total_profit_usd: 1000000, margen_promedio: 81 };
const casos: Array<{ name: string; document: ReactElement; expected: string[] }> = [
  { name: "proveedor", document: <EstadoCuentaProveedorDocument proveedorNombre="Proveedor de Querétaro" rfc="AAA010101AAA" desde="2026-10-01" hasta="2026-10-06" emisor={emisor}
    movimientos={[{ fecha: "2026-10-06", tipo: "Factura", folio: "FP-última", expediente: "EXP-01", referencia: "Última referencia", moneda: "USD", cargo: "8750.45", abono: "0", saldo: "8750.45" }]}
    aging={[{ moneda: "USD", etiqueta: "31–60 días", saldo: "8750.45" }]}
    saldos={[{ moneda: "MXN", cargos: "1234567.89", abonos: "0", saldo: "1234567.89" }, { moneda: "USD", cargos: "8750.45", abonos: "0", saldo: "8750.45" }]}
    saldoApertura={[{ moneda: "MXN", saldo: "1234567.89" }]} hayMas totalMovimientos={501} />,
    expected: ["Proveedor de Querétaro", "No representa el cierre", "Detalle parcial: 1 de 501", "Última referencia", "MXN 1,234,567.89", "USD 8,750.45"] },
  { name: "bancario", document: <EstadoCuentaBancarioDocument cuenta="Operación México" banco="Banco sintético" moneda="MXN" emisor={emisor}
    resumen={{ periodo: "01/10/2026 - 06/10/2026", cobertura: "Cobertura parcial; saldo inicial al arranque.", saldoInicial: "MXN 1,000,000.00", entradas: "MXN 234,567.89", salidas: "MXN 0.00", saldoFinal: "MXN 1,234,567.89" }}
    filas={[{ fecha: "06/10/2026", concepto: "Última operación bancaria", referencia: "Conciliación México", salida: "MXN 0.00", entrada: "MXN 234,567.89", saldo: "MXN 1,234,567.89", estado: "Conciliado" }]}
    alcance={{ filtro: "Búsqueda: México", movimientosVisibles: 1, movimientosPeriodo: 2, entradas: "MXN 234,567.89", salidas: "MXN 0.00" }} />,
    expected: ["Cobertura parcial", "Detalle exportado: 1 de 2", "saldo corrido real", "Última operación bancaria", "MXN 1,234,567.89"] },
  { name: "libro-pagos", document: <LibroPagosDocument resumen={resumenPagos} filas={[pago]} emisor={emisor} />,
    expected: ["Último pago", "devoluciones al TC del anticipo original", "MXN 1,234,567.89", "USD 8,750.45", "MXN 0.03"] },
  { name: "bitacora", document: <BitacoraTesoreriaDocument folio="FP-última" proveedor="Proveedor de Mérida" filtrosAplicados="Filtro: pagos de octubre" emisor={emisor}
    filas={[{ fecha: "06/10/2026 12:00", movimiento: "Pago registrado", monto: "USD 8,750.45", cargoMxn: "MXN 161,883.33", cuenta: "Operación México", estadoMovimiento: "Conciliado", usuario: "Última usuaria: Lucía" }]} />,
    expected: ["Filtro: pagos de octubre", "Última usuaria: Lucía", "USD 8,750.45", "MXN 161,883.33", "1 movimiento incluido"] },
  { name: "tesoreria", document: <ReporteTesoreriaDocument fechaCorte="2026-10-06" resumen={tesoreria} emisor={emisor} />,
    expected: ["Corte: 06/10/2026", "Operación México", "Acreedor de Querétaro", "MXN 1,234,567.89", "USD 8,750.45", "mayor atraso"] },
  { name: "rentabilidad", document: <RentabilidadDocument fechaDesde="2026-10-01" fechaHasta="2026-10-06" modo="Marítimo" kpis={rentabilidadKpis}
    organizacionNombre="Comercial Sintética México" emisor={emisor}
    clientes={[{ cliente_nombre: "Último cliente: Operación Marítima de Querétaro y Mérida", total_embarques: 2, venta_usd: 1234567.89, costo_usd: 234567.89, profit_usd: 1000000, margen: 81 }]} />,
    expected: ["Organización: Comercial Sintética México", "Modo: Marítimo", "ventas facturadas", "Último cliente", "USD 1,234,567.89", "81.0%"] },
  { name: "cartera", document: <ReporteCarteraDocument fechaCorte="2026-10-06" leyendaTc="TC DOF USD/MXN 18.5000" busqueda="Mérida" emisor={emisor}
    bloques={[{ titulo: "Cuentas por cobrar", totales: [{ etiqueta: "31–60 días", conteo: "1", mxnHistorico: "161883.33", mxnCorte: "166258.55", diferencia: "4375.22" }],
      facturas: [{ contraparte: "Último cliente de Mérida", folio: "F-última", expediente: "EXP-01", vencimiento: "01/09/2026", dias: "35", bucket: "31–60 días", moneda: "USD", saldo: "8750.45", mxnHistorico: "161883.33", mxnCorte: "166258.55", diferencia: "4375.22" }] }]} />,
    expected: ["TC DOF USD/MXN 18.5000", "Totales sólo de resultados coincidentes", "Último cliente de Mérida", "USD 8,750.45", "MXN 4,375.22"] },
  { name: "eerr", document: <ReporteEERRDocument periodo="2026-10" fuente="facturas" data={eerr} emisor={emisor} />,
    expected: ["Devengada (facturas)", "Reporte provisional", "Último costo aéreo", "MXN 1,234,567.89", "MXN 1,000,000.00"] },
  { name: "presupuesto", document: <ReportePresupuestoDocument resumen={presupuesto} emisor={emisor} />,
    expected: ["Última categoría logística", "MXN 1,234,567.89", "periodo completo", "Reporte provisional", "123.5%"] },
  { name: "ejecutivo", document: <ReporteEjecutivoDocument snapshot={ejecutivo} emisor={emisor} />,
    expected: ["Fuente EERR: Facturas (devengada)", "Bases sin IVA", "respaldo estimado", "Última alerta", "MXN 1,234,567.89", "USD 8,750.45"] },
];

describe("Sistema visual compartido de reportes: renderer real", () => {
  it.each(casos)("preserva identidad, alcance y cifras de $name", async ({ name, document, expected }) => {
    const pdf = await inspectPdf(`diseno-${name}`, document);
    for (const text of [...expected, "Logística Regiomontana QA", "Página 1 de"]) expect(pdf.text).toContain(text);
  });

  it("mantiene legible la etiqueta larga de un ajuste no monetario", async () => {
    const ajuste: FilaLibroPagosExport = { ...pago, tipo: "Ajuste no monetario", estado: "No aplica", documento: "AJ-DEMO-01", referencia: "Ajuste de apertura", monto: "MXN 1.00", montoMxn: "MXN 1.00", tipoCambio: "1.0000", metodo: "No aplica", cuenta: "No aplica" };
    const resumen = { ...resumenPagos, cobrado: "MXN 0.00", pagado: "MXN 0.00", devuelto: "MXN 0.00", neto: "MXN 0.00", conteo: "2" };
    const pdf = await inspectPdf("diseno-libro-ajuste-no-monetario", <LibroPagosDocument resumen={resumen} filas={[{ ...ajuste, documento: "AJ-1" }, ajuste]} emisor={emisor} />);
    for (const text of ["Ajuste no monetario", "No aplica", "MXN 1.00", "AJ-1", "AJ-DEMO-01"]) expect(pdf.text).toContain(text);
    expect(pdf.pages).toBe(1);
  });

  it("conserva completo un folio largo sin alterar importe o estado", async () => {
    const folio = "AJ-" + "IDENTIFICADOR1234567890".repeat(2);
    const pdf = await inspectPdf("diseno-libro-folio-largo", <LibroPagosDocument resumen={resumenPagos} filas={[{ ...pago, documento: folio }]} emisor={emisor} />);
    expect(pdf.rawText.replace(/\s/g, "")).toContain(folio);
    for (const text of ["USD 8,750.45", "MXN 161,883.33", "Pendiente"]) expect(pdf.text).toContain(text);
  });

  it("pagina un libro largo sin perder pagos, totales o el último renglón", async () => {
    const filas = Array.from({ length: 65 }, (_, i) => ({ ...pago, referencia: `Pago final ${String(i + 1).padStart(2, "0")}` }));
    const pdf = await inspectPdf("diseno-libro-pagos-largo", <LibroPagosDocument emisor={emisor}
      resumen={{ ...resumenPagos, conteo: "65" }} filas={filas} />);
    expect(pdf.pages).toBeGreaterThan(1);
    for (const text of ["Pago final 01", "Pago final 65", "DEVOLUCIONES (MXN):", "MXN 0.03", "PAGOS INCLUIDOS:", "65"]) expect(pdf.text).toContain(text);
    expect(pdf.text).toContain(`Página ${pdf.pages} de ${pdf.pages}`);
  });

  it("mantiene alcance y aviso provisional en presupuesto vacío filtrado", async () => {
    const pdf = await inspectPdf("diseno-presupuesto-vacio", <ReportePresupuestoDocument resumen={presupuesto} filas={[]} soloExcesos />);
    for (const text of ["Documento interno", "Ninguna categoría excede", "Solo excesos", "periodo completo", "Reporte provisional"]) expect(pdf.text).toContain(text);
    expect(pdf.text).not.toContain("Última categoría logística");
    expect(pdf.text).not.toContain("RFC:");
  });

  it("identifica banco vacío sin ocultar la cobertura ni inventar movimientos", async () => {
    const pdf = await inspectPdf("diseno-bancario-vacio", <EstadoCuentaBancarioDocument cuenta="Operación México" banco="Banco sintético" moneda="MXN" filas={[]}
      resumen={{ periodo: "01/10/2026 - 06/10/2026", cobertura: "Cobertura parcial de octubre", saldoInicial: "MXN 0.00", entradas: "MXN 0.00", salidas: "MXN 0.00", saldoFinal: "MXN 0.00" }} />);
    for (const text of ["Documento interno", "Cobertura parcial de octubre", "No hay movimientos", "Resumen de todo el periodo", "SALDO FINAL:"]) expect(pdf.text).toContain(text);
  });
});
