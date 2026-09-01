/**
 * Superficie pública de los servicios de catálogos compartidos.
 *
 * Ola 20 · paso 4: este archivo SOLO re-exporta. La lógica vive en
 * `navieras.ts`, `puertos.ts`, `tiposContenedor.ts` y `exchangeRates.ts`, y los
 * tipos en `catalogosTypes.ts`, para que importar un tipo no arrastre el
 * cliente de base de datos.
 */
export type { Naviera, Puerto, TipoContenedor } from "./catalogosTypes";
export { fetchNavieras, insertNaviera, setNavieraActivo, deleteNaviera, updateNaviera } from "./navieras";
export { fetchPuertos, insertPuerto, setPuertoActivo, deletePuerto } from "./puertos";
export {
  fetchTiposContenedor,
  insertTipoContenedor,
  setTipoContenedorActivo,
  deleteTipoContenedor,
} from "./tiposContenedor";
export { EXCHANGE_RATES_FALLBACK, fetchExchangeRates } from "./exchangeRates";
