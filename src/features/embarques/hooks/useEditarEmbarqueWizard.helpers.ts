/**
 * Helpers puros de `useEditarEmbarqueWizard`. Sin React.
 */
import type { ContenedorBorrador } from "@/features/embarques/types/contenedor";
import type { FieldDiff, ConceptosDiff } from "@/features/auditoria/utils/diffFields";
import {
  esNumeroContenedorValido,
  ISO6346_MENSAJE,
} from "@/features/embarques/domain/contenedorIso6346";

/**
 * Marítimo exige número + tipo en cada contenedor. Devuelve `null` si OK,
 * o un objeto con el mensaje para mostrar al usuario y el paso a re-abrir.
 * Además valida que los números con contenido cumplan ISO 6346 antes de
 * enviar al backend (el CHECK `contenedor_iso6346` los rechaza si no).
 */
export function validarContenedoresMaritimo(
  modo: string,
  contenedores: ContenedorBorrador[],
): { description: string; step: number } | null {
  if (modo !== "Marítimo") return null;
  const faltan = contenedores.some(
    (c) => !c.numero_contenedor.trim() || !c.tipo_contenedor.trim(),
  );
  if (faltan) {
    return {
      description: "Cada contenedor requiere número y tipo. Revisa el paso 2.",
      step: 2,
    };
  }
  const invalidos = contenedores.some((c) => !esNumeroContenedorValido(c.numero_contenedor));
  if (invalidos) {
    return {
      description: `Número de contenedor inválido. ${ISO6346_MENSAJE}`,
      step: 2,
    };
  }
  return null;
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
