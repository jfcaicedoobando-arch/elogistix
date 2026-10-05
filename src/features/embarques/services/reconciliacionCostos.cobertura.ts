/** Faltantes por concepto: un excedente ajeno no liquida su presupuesto. */
import { TOLERANCIA_CONCILIACION, type FilaReconciliacion } from "./reconciliacionCostos.tipos";

interface Pendientes { pendiente: number; conceptos_pendientes: number }
interface Cohorte { ordinarios: FilaReconciliacion[]; ajustes: FilaReconciliacion[] }

export const claveGrupoConciliacion = (fila: Pick<FilaReconciliacion, "embarque_id" | "moneda">) =>
  `${fila.embarque_id ?? ""}|${fila.moneda}`;

function claveFacturaComparable(fila: FilaReconciliacion): string | null {
  if (fila.estatus_renglon === "no_comparable" || fila.facturas.some((factura) => factura.excluida)) return null;
  const ids = new Set(fila.facturas.map((factura) => factura.proveedor_factura_id));
  // El presupuesto de un costo compartido por varias facturas no se reparte
  // arbitrariamente: el writer no conserva el ID padre del ajuste.
  return ids.size === 1 ? `${claveGrupoConciliacion(fila)}|${[...ids][0]}` : null;
}

const direccion = (fila: FilaReconciliacion) => fila.cotizado < 0 ? -1 : 1;
const saldo = (fila: FilaReconciliacion) => (fila.cotizado - fila.real_facturado) * direccion(fila);
const falta = (fila: FilaReconciliacion) => Math.max(0, saldo(fila));
function esPendiente(fila: FilaReconciliacion): boolean {
  if (fila.estatus_renglon === "no_comparable") return false;
  return fila.estatus_renglon === "sin_match" ||
    fila.real_facturado * direccion(fila) < Math.abs(fila.cotizado) - Math.abs(fila.cotizado) * TOLERANCIA_CONCILIACION ||
    (fila.cotizado === 0 && fila.real_facturado !== 0);
}

function calcularCohorte({ ordinarios, ajustes }: Cohorte): Pendientes {
  // Ajuste FX sin base en esta moneda: sigue siendo presupuesto nativo N/D,
  // no un faltante atribuible a conceptos de otra factura.
  if (ordinarios.length === 0) return { pendiente: 0, conceptos_pendientes: 0 };
  const deficit = ordinarios.reduce((sum, fila) => sum + falta(fila), 0);
  const pendientes = ordinarios.filter(esPendiente).length;
  const signos = new Set(ordinarios.map(direccion));
  const explicitos = ajustes.filter((fila) => fila.cotizado !== 0);
  if (explicitos.length === 0) return { pendiente: deficit, conceptos_pendientes: pendientes };
  // Sin base o con signos legacy mezclados no hay una dirección verificable
  // para atribuir el delta. Conserva el faltante y el nuevo presupuesto positivo.
  if (signos.size !== 1) {
    const nuevo = explicitos.reduce((sum, fila) => sum + Math.max(0, fila.cotizado), 0);
    return { pendiente: deficit + nuevo,
      conceptos_pendientes: Math.min(ordinarios.length, pendientes + (nuevo > 0 ? 1 : 0)) };
  }
  const signo = direccion(ordinarios[0]);
  let reducciones = 0;
  let ampliaciones = 0;
  for (const ajuste of explicitos) {
    const delta = ajuste.cotizado * signo;
    reducciones += Math.max(0, -delta);
    ampliaciones += Math.max(0, delta);
  }
  const excedente = ordinarios.reduce((sum, fila) => sum + Math.max(0, -saldo(fila)), 0);
  // Sólo el ajuste negativo reduce déficits; sólo el positivo permite usar
  // excedentes de esta factura/embarque/moneda. Nunca excedente contra déficit.
  const pendiente = Math.max(0, deficit - reducciones) + Math.max(0, ampliaciones - excedente);
  // Absorbe sólo representación IEEE de sumas/restas; no añade una tolerancia
  // monetaria de un centavo a la tolerancia relativa del contrato.
  const escalaRepresentacion = ordinarios.reduce((escala, fila) =>
    Math.max(escala, Math.abs(fila.cotizado), Math.abs(fila.real_facturado)),
  Math.max(1, deficit, reducciones, ampliaciones, excedente));
  const errorRepresentacion = Number.EPSILON * escalaRepresentacion * 4;
  if (pendiente <= errorRepresentacion) return { pendiente: 0, conceptos_pendientes: 0 };
  const presupuesto = (ordinarios.reduce((sum, fila) => sum + fila.cotizado, 0) +
    explicitos.reduce((sum, fila) => sum + fila.cotizado, 0)) * signo;
  if (ordinarios.length === 1 && ordinarios[0].real_facturado * signo >=
    presupuesto - Math.abs(presupuesto) * TOLERANCIA_CONCILIACION) {
    return { pendiente, conceptos_pendientes: 0 };
  }
  // Con varias bases no se aplica su tolerancia conjunta al faltante de un
  // costo desconocido ni se inventa cuál de los costos pendientes cubrió.
  return { pendiente, conceptos_pendientes: Math.max(pendientes, 1) };
}

/** Cobertura nominal se calcula aparte; estos valores conservan faltantes reales. */
export function calcularPendientesConciliacion(filas: FilaReconciliacion[]): Map<string, Pendientes> {
  const resultado = new Map<string, Pendientes>();
  const cohortes = new Map<string, Cohorte>();
  const grupoDeCohorte = new Map<string, string>();
  const sumar = (grupo: string, valor: Pendientes) => {
    const anterior = resultado.get(grupo) ?? { pendiente: 0, conceptos_pendientes: 0 };
    anterior.pendiente += valor.pendiente;
    anterior.conceptos_pendientes += valor.conceptos_pendientes;
    resultado.set(grupo, anterior);
  };
  for (const fila of filas) {
    const grupo = claveGrupoConciliacion(fila);
    const clave = claveFacturaComparable(fila);
    if (!clave) {
      if (!fila.ajuste_presupuestario) sumar(grupo, { pendiente: falta(fila), conceptos_pendientes: Number(esPendiente(fila)) });
      continue;
    }
    const cohorte = cohortes.get(clave) ?? { ordinarios: [], ajustes: [] };
    (fila.ajuste_presupuestario ? cohorte.ajustes : cohorte.ordinarios).push(fila);
    cohortes.set(clave, cohorte);
    grupoDeCohorte.set(clave, grupo);
  }
  for (const [clave, cohorte] of cohortes) sumar(grupoDeCohorte.get(clave)!, calcularCohorte(cohorte));
  return resultado;
}
