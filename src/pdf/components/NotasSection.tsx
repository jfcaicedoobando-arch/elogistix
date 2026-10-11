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
import { notasParaCliente } from "@/lib/domain/notasVisibilidad";
import { styles } from "../theme/styles";
import { splitNotas } from "./notasSplit";
import { DescriptionText } from "../text/DescriptionText";

const keepNoteToken = (word: string) => [word];
// Compose equivalent Unicode glyphs for Inter's PDF font subset. The stored
// note remains unchanged; layout-only breaks add neither hyphens nor clipping.

interface Props {
  notas?: string | null;
}

/** Bounded opening shared with the compact proforma closing row. */
export function NotasInicio({ texto, continua = false, compacta = false }: { texto: string; continua?: boolean; compacta?: boolean }) {
  if (!texto) return null;
  return <View wrap={false}>
    <Text style={[styles.h3, { marginTop: 10, marginBottom: 6 }, compacta ? { marginBottom: 4, paddingBottom: 2 } : {}]}>Notas</Text>
    <View style={[styles.notesBox, compacta ? { marginTop: 0, padding: 6 } : {}, continua ? { marginBottom: 0, paddingBottom: 0 } : {}]}>
      <Text hyphenationCallback={compacta ? keepNoteToken : undefined}>
        {compacta ? <DescriptionText text={texto.normalize("NFC")} maxWidth={200} fontSize={10} /> : texto}
      </Text>
    </View>
  </View>;
}

/** Remaining notes can flow freely; a column opening uses a separate box. */
export function NotasContinuacion({ texto, separada = false }: { texto: string; separada?: boolean }) {
  if (!texto) return null;
  return <View style={[styles.notesBox, separada ? {} : { marginTop: 0, paddingTop: 0 }]}>
    <Text hyphenationCallback={separada ? keepNoteToken : undefined}>
      {separada ? <DescriptionText text={texto.normalize("NFC")} maxWidth={500} fontSize={10} /> : texto}
    </Text>
  </View>;
}

export function NotasSection({ notas }: Props) {
  // v13.823.345: el PDF es superficie de cliente — las notas internas
  // ([interno], #interno, residuos "QA SMOKE") se filtran aquí. Si sólo había
  // notas internas, no se renderiza el bloque.
  const texto = notasParaCliente(notas);
  if (!texto) return null;

  const { head, rest } = splitNotas(texto);
  const hayResto = rest.length > 0;

  return (
    <View>
      <NotasInicio texto={head} continua={hayResto} />
      <NotasContinuacion texto={rest} />
    </View>
  );
}
