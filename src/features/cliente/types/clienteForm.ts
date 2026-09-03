/**
 * Tipo del formulario "Convertir Prospecto a Cliente".
 * Movido desde src/components/cotizacion/DialogConvertirProspecto.tsx para evitar que hooks
 * importen tipos desde components.
 *
 * P0 (conversión canónica): el alta desde la conversión captura los MISMOS
 * datos fiscales que el módulo de Clientes; la RPC los exige antes de escribir.
 */
export interface ClienteFormData {
  nombre: string;
  contacto: string;
  email: string;
  telefono: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  regimen_fiscal: string;
  uso_cfdi_default: string;
  forma_pago_default: string;
  metodo_pago_default: string;
}

/** Defaults fiscales del alta (idénticos a `EMPTY_CLIENTE` del módulo Clientes). */
export const CLIENTE_FISCAL_DEFAULTS = {
  regimen_fiscal: "",
  uso_cfdi_default: "G03",
  forma_pago_default: "99",
  metodo_pago_default: "PPD",
} as const;

/** Formulario vacío con los defaults fiscales aplicados. */
export const EMPTY_CLIENTE_FORM: ClienteFormData = {
  nombre: "", contacto: "", email: "", telefono: "",
  rfc: "", direccion: "", ciudad: "", estado: "", cp: "",
  ...CLIENTE_FISCAL_DEFAULTS,
};
