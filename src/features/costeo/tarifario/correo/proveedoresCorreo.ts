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

/** «Base Ports» de Golden: una tarifa por cada puerto de la lista. */
export const GOLDEN_BASE_PORTS = [
  "CNSHA", "CNZOS", "CNSNZ", "CNCAN", "CNXMG", "CNQDG", "CNTXG", "CNDLC", "HKHKG",
] as const;

/** Puertos de origen reconocibles en los correos (nombres tal como escriben). */
export const PUERTOS_ORIGEN_CORREO = [
  "Yantian", "Shekou", "Shenzhen", "Shanghai", "Ningbo", "Qingdao",
  "Xiamen", "Xingang", "Dalian", "Hongkong", "Hong Kong", "Fuzhou",
  "Lianyungang", "Huangpu", "Nansha", "Zhuhai",
] as const;
