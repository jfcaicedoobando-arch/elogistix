/**
 * Topes (`.limit`) de las consultas a la base, con nombre y motivo.
 *
 * Paso 7 de la auditoría: los números 500 / 1000 / 2000 / 5000 estaban repartidos
 * en 38 servicios, cada uno con el motivo escrito como comentario suelto. Al no
 * tener nombre, nadie sabía cuál era "el tope correcto" y una tabla que crece
 * cortaba datos en silencio.
 *
 * PostgREST corta en 1000 filas por defecto aunque no se pida `.limit`, por eso
 * todos estos topes son *defensivos*: se piden explícitamente para que el corte
 * sea visible y, donde aplique, se avise con `warnIfTruncated`.
 */

/** Listas y catálogos que alimentan selectores o tablas paginadas en pantalla. */
export const CAP_LISTA = 500;

/** Tope duro de PostgREST: pedir más sin paginar no trae nada extra. */
export const CAP_POSTGREST = 1000;

/** Reportes y agregados que barren un periodo completo. */
export const CAP_REPORTE = 2000;

/** Conciliaciones y barridos históricos amplios (varios periodos). */
export const CAP_REPORTE_AMPLIO = 5000;

/**
 * Tope duro de lectura por lotes para barridos que ya no pueden aceptar un
 * corte silencioso (p. ej. conciliación de embarques): si se alcanza, la
 * consulta debe fallar explícitamente en vez de mostrar un total parcial.
 */
export const CAP_LOTES_DURO = 50_000;
