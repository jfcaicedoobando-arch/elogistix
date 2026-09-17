/**
 * MNY-P2.6 — lectura paginada y acotada de candidatos para conciliación.
 *
 * Antes se leían sólo los primeros 21 pagos de la ventana y después se
 * descartaban los ya vinculados a un movimiento bancario: si esos 21 estaban
 * ligados, el panel mostraba "Sin candidatos" aunque existiera uno válido más
 * adelante. Ahora se siguen leyendo páginas (con tope duro) hasta juntar
 * suficientes candidatos NO vinculados, conservando la señal `truncado` para
 * que la auto-conciliación se abstenga cuando hay ambigüedad.
 */
import type { Candidato, SugerenciasResultado } from "./sugerirCandidatos.tipos";

/** Tope duro de páginas: nunca se lee sin límite. */
export const PAGINAS_MAX = 5;

interface RespuestaPagina<F> {
  data: F[] | null;
  error: { message: string } | null;
}

/**
 * @param tamPagina    filas por petición (normalmente `LIMITE_SUGERENCIAS + 1`).
 * @param leerPagina   consulta acotada por `.range(desde, hasta)`.
 * @param aCandidatos  filtra los ya vinculados y arma los candidatos de la página.
 */
export async function acumularCandidatos<F>(
  tamPagina: number,
  leerPagina: (desde: number, hasta: number) => PromiseLike<RespuestaPagina<F>>,
  aCandidatos: (filas: F[]) => Promise<Candidato[]>,
): Promise<SugerenciasResultado> {
  const candidatos: Candidato[] = [];
  for (let pagina = 0; pagina < PAGINAS_MAX; pagina++) {
    const desde = pagina * tamPagina;
    const { data, error } = await leerPagina(desde, desde + tamPagina - 1);
    // Un error de lectura NO puede verse como "sin coincidencias".
    if (error) throw error;
    const filas = data ?? [];
    candidatos.push(...(await aCandidatos(filas)));
    // Con más candidatos que el tope no se puede afirmar que el match sea único.
    if (candidatos.length >= tamPagina) return { candidatos, truncado: true };
    // Página incompleta = ya se agotó la ventana: la lista es completa.
    if (filas.length < tamPagina) return { candidatos, truncado: false };
  }
  // Se alcanzó el tope de páginas: puede haber candidatos no leídos.
  return { candidatos, truncado: true };
}
