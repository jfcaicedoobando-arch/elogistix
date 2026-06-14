/**
 * Helpers puros de `useEditarEmbarqueWizard`. Sin React.
 */
import type { ContenedorBorrador } from "@/features/embarques/types/contenedor";
import type { FieldDiff, ConceptosDiff } from "@/features/auditoria/utils/diffFields";

/**
 * Marítimo exige número + tipo en cada contenedor. Devuelve `null` si OK,
 * o un objeto con el mensaje para mostrar al usuario y el paso a re-abrir.
 */
export function validarContenedoresMaritimo(
  modo: string,
  contenedores: ContenedorBorrador[],
): { description: string; step: number } | null {
  if (modo !== "Marítimo") return null;
  const faltan = contenedores.some(
    (c) => !c.numero_contenedor.trim() || !c.tipo_contenedor.trim(),
  );
  if (!faltan) return null;
  return {
    description: "Cada contenedor requiere número y tipo. Revisa el paso 2.",
    step: 2,
  };
}

interface BitacoraEditInput {
  clienteNombre: string;
  modo: string;
  tipo: string;
  cambiosEmbarque: FieldDiff[];
  cambiosVenta: ConceptosDiff;
  cambiosCosto: ConceptosDiff;
}

/**
 * Construye el objeto `detalles` de bitácora para edición de embarque,
 * añadiendo `cambios` solo si hubo diffs reales.
 */
export function buildBitacoraDetallesEdit(input: BitacoraEditInput): Record<string, unknown> {
  const { clienteNombre, modo, tipo, cambiosEmbarque, cambiosVenta, cambiosCosto } = input;
  const tuvoCambios = cambiosEmbarque.length > 0
    || cambiosVenta.agregados + cambiosVenta.eliminados + cambiosVenta.modificados > 0
    || cambiosCosto.agregados + cambiosCosto.eliminados + cambiosCosto.modificados > 0;
  return {
    cliente: clienteNombre,
    modo,
    tipo,
    ...(tuvoCambios && {
      cambios: JSON.parse(JSON.stringify({
        embarque: cambiosEmbarque,
        ventas: cambiosVenta,
        costos: cambiosCosto,
      })),
    }),
  };
}
