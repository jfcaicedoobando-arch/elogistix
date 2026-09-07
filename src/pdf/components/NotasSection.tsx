/**
 * Bloque "Notas" de las proformas.
 *
 * Contrato de maquetación (R188-PDF-01):
 * - El título y las primeras líneas viven en un `View wrap={false}` pequeño, de
 *   modo que si no caben, saltan JUNTOS a la página siguiente.
 * - El resto del texto queda fuera de ese bloque y puede repartirse en varias
 *   páginas (notas largas), sin `wrap={false}`.
 * - Sin notas no se renderiza nada (ni título vacío ni página extra).
 */
import { Text, View } from "@react-pdf/renderer";
import { styles } from "../theme/styles";
import { splitNotas } from "./notasSplit";

interface Props {
  notas?: string | null;
}

export function NotasSection({ notas }: Props) {
  const texto = (notas ?? "").trim();
  if (!texto) return null;

  const { head, rest } = splitNotas(texto);
  const hayResto = rest.length > 0;

  return (
    <View>
      <View wrap={false}>
        <Text style={[styles.h3, { marginTop: 10, marginBottom: 6 }]}>Notas</Text>
        <View style={[styles.notesBox, hayResto ? { marginBottom: 0, paddingBottom: 0 } : {}]}>
          <Text>{head}</Text>
        </View>
      </View>
      {hayResto ? (
        <View style={[styles.notesBox, { marginTop: 0, paddingTop: 0 }]}>
          <Text>{rest}</Text>
        </View>
      ) : null}
    </View>
  );
}
