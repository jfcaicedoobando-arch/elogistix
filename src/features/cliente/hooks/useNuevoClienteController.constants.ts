/** Valores y checklist inicial del alta; los opcionales se adjuntan en el detalle. */
export const EMPTY_CLIENTE = {
  nombre: "", rfc: "", direccion: "", ciudad: "", estado: "", cp: "", contacto: "", email: "", telefono: "",
  regimen_fiscal: "", uso_cfdi_default: "G03", forma_pago_default: "99", metodo_pago_default: "PPD",
};

export const DOC_CSF = "Constancia de Situación Fiscal (CSF)";
export const DOCS_OBLIGATORIOS = [
  DOC_CSF, "CIF", "Opinión fiscal", "Acta constitutiva", "INE RL", "Poder notarial",
  "Comprobante de domicilio", "Datos bancarios", "Opinión de cumplimiento IMSS/Infonavit",
  "Contrato de servicios con Libre Carga", "Estados financieros último corte",
];

export type ModoAlta = "manual" | "csf";
export type ClienteForm = typeof EMPTY_CLIENTE;
