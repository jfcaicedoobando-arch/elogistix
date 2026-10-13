/**
 * Constantes compartidas del extractor de tarifas por correo.
 * Los nombres de agente son claves de búsqueda contra el catálogo
 * `costeo_agentes`; la naviera se emite como código del catálogo `navieras`.
 */

export type ProveedorCorreo = "longsail" | "golden" | "oriental" | "rainbow";

export const NOMBRE_PROVEEDOR: Record<ProveedorCorreo, string> = {
  longsail: "Longsail",
  golden: "Golden",
  oriental: "Oriental",
  rainbow: "Rainbow",
};

/** Clave para localizar al agente en el catálogo por coincidencia parcial. */
export const AGENTE_CLAVE: Record<ProveedorCorreo, string> = {
  longsail: "LONGSAIL",
  golden: "SHENZHEN GOLDEN SHIPPING",
  oriental: "ORIENTAL INTERNATIONAL",
  rainbow: "RAINBOW LOGISTICS",
};

/** Siglas que usan los correos → código del catálogo de navieras. */
export const NAVIERA_POR_SIGLA: Record<string, string> = {
  MSK: "MAEU", MAERSK: "MAEU",
  MSC: "MSCU",
  COSCO: "COSU", CO: "COSU",
  CMA: "CMDU",
  EMC: "EGLV", EM: "EGLV",
  HPL: "HLCU",
  ONE: "ONEY",
  OOCL: "OOLU", OO: "OOLU",
  PIL: "PCIU", PI: "PCIU",
  TSL: "TXZJ", TS: "TXZJ",
  WHL: "WHLC", WH: "WHLC",
  YML: "YMLU", YM: "YMLU",
  ZIM: "ZIMU", ZI: "ZIMU",
  RCL: "RCLU", RC: "RCLU",
  SN: "SNKO",
};

/**
 * «Base Ports» de Golden: una tarifa por cada puerto de la lista, con el
 * nombre exacto del catálogo `puertos`. Zhoushan (CNZOS) no existe en el
 * catálogo y se omite.
 */
export const GOLDEN_BASE_PORTS = [
  "Shanghai", "Shenzhen", "Guangzhou", "Xiamen", "Qingdao",
  "Tianjin (Xingang)", "Dalian", "Hong Kong",
] as const;

/** Nombres como los escriben los agentes → nombre exacto del catálogo `puertos`. */
export const ALIAS_PUERTOS: Record<string, string> = {
  xingang: "Tianjin (Xingang)",
  tianjin: "Tianjin (Xingang)",
  hongkong: "Hong Kong",
  yantian: "Shenzhen Yantian",
  shekou: "Shenzhen Shekou",
};

/** Puertos de origen reconocibles en los correos (nombres tal como escriben). */
export const PUERTOS_ORIGEN_CORREO = [
  "Yantian", "Shekou", "Shenzhen", "Shanghai", "Ningbo", "Qingdao",
  "Xiamen", "Xingang", "Dalian", "Hongkong", "Hong Kong", "Fuzhou",
  "Lianyungang", "Huangpu", "Nansha", "Zhuhai",
] as const;
