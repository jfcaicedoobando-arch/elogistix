/**
 * Preflight de NUEVAS facturas de ingreso (CFDI 4.0). Fuente pura única para
 * navegador y edge. No se aplica a REP/NC, recuperación ni lectura de XML.
 * Verificado 2026-10-07:
 * - Facturapi, tabla Uso CFDI: https://docs.facturapi.io/api/
 * - SAT Anexo 20, pp. 76–77, RegimenFiscalReceptor/UsoCFDI:
 *   https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175118249&ssbinary=true
 * La compatibilidad no determina el uso que desea el receptor. Nunca se
 * sustituye una selección incompatible ni se infiere una factura global.
 */
const REGIMENES_GASTOS = ["601", "603", "606", "612", "620", "621", "622", "623", "624", "625", "626"];
const REGIMENES_DEDUCCIONES = ["605", "606", "607", "608", "611", "612", "614", "615", "625"];
const REGIMENES_SIN_EFECTOS = ["601", "603", "605", "606", "607", "608", "610", "611", "612", "614", "615", "616", "620", "621", "622", "623", "624", "625", "626"];
const USOS_GASTOS = ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08"];
const USOS_DEDUCCIONES = ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10"];

export const USOS_CFDI_INGRESO: readonly string[] = [...USOS_GASTOS, ...USOS_DEDUCCIONES, "S01"];

export interface ReceptorUsoCfdi {
  rfc: string;
  regimen: string;
  usoCfdi: string;
}
export interface IssueUsoCfdi {
  field: "uso_cfdi" | "regimen_fiscal";
  code: "uso_requerido" | "uso_tipo" | "uso_persona" | "uso_regimen" | "regimen_generico";
  message: string;
}

/** Snapshot del borrador primero, igual que el payload del PAC; vacío no es ausencia. */
export function rfcReceptorFactura(rfcFactura: string | null | undefined, rfcCliente: string | null | undefined): string {
  return rfcFactura ?? rfcCliente ?? "";
}

function validarUsoIngreso(uso: string): IssueUsoCfdi | null {
  if (!uso) return { field: "uso_cfdi", code: "uso_requerido", message: "Uso de CFDI requerido." };
  if (!USOS_CFDI_INGRESO.includes(uso)) return {
    field: "uso_cfdi", code: "uso_tipo",
    message: `El uso ${uso} no es válido para emitir una factura de ingreso CFDI 4.0. Elige un uso vigente para este comprobante.`,
  };
  return null;
}

function validarUsoPersona(uso: string, rfc: string): IssueUsoCfdi | null {
  if (rfc.length === 12 && USOS_DEDUCCIONES.includes(uso)) return {
    field: "uso_cfdi", code: "uso_persona",
    message: `El uso ${uso} sólo aplica a personas físicas; el RFC ${rfc} corresponde a una persona moral.`,
  };
  return null;
}

function validarRegimenGenerico(rfc: string, regimen: string): IssueUsoCfdi | null {
  if ((rfc === "XAXX010101000" || rfc === "XEXX010101000") && regimen !== "616") return {
    field: "regimen_fiscal", code: "regimen_generico",
    message: `El RFC genérico ${rfc} requiere régimen fiscal 616 (Sin obligaciones fiscales).`,
  };
  return null;
}

function validarUsoRegimen(uso: string, regimen: string): IssueUsoCfdi | null {
  const permitidos = uso === "S01" ? REGIMENES_SIN_EFECTOS
    : USOS_DEDUCCIONES.includes(uso) ? REGIMENES_DEDUCCIONES : REGIMENES_GASTOS;
  if (!permitidos.includes(regimen)) return {
    field: "uso_cfdi", code: "uso_regimen",
    message: `El uso ${uso} no es compatible con el régimen fiscal ${regimen || "sin capturar"}. Elige un uso compatible antes de timbrar.`,
  };
  return null;
}

/** Reglas independientes: tipo/vigencia, persona, RFC genérico y régimen/uso. */
export function validarUsoCfdiIngreso(p: ReceptorUsoCfdi): IssueUsoCfdi[] {
  const rfc = p.rfc.trim().toUpperCase();
  const issues: IssueUsoCfdi[] = [];
  const generico = validarRegimenGenerico(rfc, p.regimen);
  if (generico) issues.push(generico);
  const tipo = validarUsoIngreso(p.usoCfdi);
  if (tipo) return [...issues, tipo];
  const persona = validarUsoPersona(p.usoCfdi, rfc);
  const regimen = validarUsoRegimen(p.usoCfdi, p.regimen);
  if (persona) issues.push(persona);
  if (regimen) issues.push(regimen);
  return issues;
}
