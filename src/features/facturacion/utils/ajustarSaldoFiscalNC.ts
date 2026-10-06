import { roundMoney } from "@/lib/financial/financialUtils";
import { factorTotalNC, impuestosLineaNC } from "./impuestosNotaCredito";
import { calcularTotalesNC } from "./notaCreditoTotales";
import type { ConceptoNotaCredito } from "../services/notasCredito";

const centavos = (n: number) => Math.round(roundMoney(n) * 100);
type Ajuste = { indice: number; linea: ConceptoNotaCredito; delta: number };

/**
 * Busca bases a centavos; impuestos se evalúan con el MISMO motor de emisión.
 * Nunca devuelve una aproximación como si fuera el saldo completo. Algunas
 * combinaciones de impuestos no pueden representar cada centavo con una línea.
 */
export function ajustarSaldoFiscalNC(saldo: number, lineas: ConceptoNotaCredito[]): ConceptoNotaCredito[] | null {
  const objetivo = centavos(saldo);
  const diferencia = objetivo - centavos(calcularTotalesNC(lineas).total);
  if (!Number.isSafeInteger(objetivo)) return null;
  if (diferencia === 0) return lineas;
  const ajustes: Ajuste[] = [];
  for (const [indice, linea] of lineas.entries()) {
    const factor = factorTotalNC(linea);
    if (!(factor > 0)) return null;
    const original = centavos(impuestosLineaNC(linea).total);
    const centros = [centavos(linea.precio_unitario), centavos(linea.precio_unitario) + Math.round(diferencia / factor)];
    for (const centro of centros) {
      // Tres impuestos redondeados pueden mover varios centavos del despeje.
      for (let offset = -4; offset <= 4; offset += 1) {
        const precio = (centro + offset) / 100;
        if (precio < 0) continue;
        const candidata = { ...linea, precio_unitario: precio };
        const delta = centavos(impuestosLineaNC(candidata).total) - original;
        ajustes.push({ indice, linea: candidata, delta });
      }
    }
  }
  const aplicar = (a: Ajuste, b?: Ajuste) => lineas.map((l, i) => i === a.indice ? a.linea : i === b?.indice ? b.linea : l);
  const directo = ajustes.find((a) => a.delta === diferencia);
  if (directo) return aplicar(directo);
  const porDelta = new Map<number, Ajuste[]>();
  for (const a of ajustes) {
    const pareja = porDelta.get(diferencia - a.delta)?.find((b) => b.indice !== a.indice);
    if (pareja) return aplicar(a, pareja);
    const grupo = porDelta.get(a.delta) ?? [];
    // Dos índices diferentes bastan para encontrar una pareja independiente.
    if (grupo.length < 2 && !grupo.some((b) => b.indice === a.indice)) grupo.push(a);
    porDelta.set(a.delta, grupo);
  }
  return null;
}
