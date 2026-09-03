/**
 * Validación del alta de cliente en la conversión Prospecto → Cliente.
 *
 * Espejo EXACTO de lo que exige `public.convertir_prospecto_a_cliente_rpc`:
 * nombre, contacto, email, teléfono, RFC, CP, régimen fiscal, uso CFDI, forma
 * y método de pago; con RFC real (no genérico) también dirección. Si esta lista
 * cambia hay que cambiar también la RPC.
 */
import type { ClienteFormData } from "@/features/cliente/types/clienteForm";
import { esRfcMxValido, esRfcGenerico, normalizarRfc } from "@/lib/validation/rfcMx";

export type ErroresClienteConversion = Partial<Record<keyof ClienteFormData, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CP_RE = /^\d{5}$/;

const vacio = (v: string | undefined) => !v || v.trim() === "";

/** Devuelve un mapa campo → mensaje; vacío significa "listo para convertir". */
export function validarClienteConversion(form: ClienteFormData): ErroresClienteConversion {
  const e: ErroresClienteConversion = {};

  if (vacio(form.nombre)) e.nombre = "Captura el nombre o razón social.";
  if (vacio(form.contacto)) e.contacto = "Captura el nombre del contacto.";
  if (vacio(form.email)) e.email = "Captura el correo del cliente.";
  else if (!EMAIL_RE.test(form.email.trim())) e.email = "El correo no tiene un formato válido.";
  if (vacio(form.telefono)) e.telefono = "Captura el teléfono del cliente.";

  const rfc = normalizarRfc(form.rfc);
  if (rfc === "") e.rfc = "Captura el RFC (o el genérico XAXX010101000).";
  else if (!esRfcMxValido(rfc)) e.rfc = "El RFC no cumple el formato del SAT.";

  if (vacio(form.cp)) e.cp = "Captura el código postal fiscal.";
  else if (!CP_RE.test(form.cp.trim())) e.cp = "El código postal debe tener 5 dígitos.";

  if (vacio(form.regimen_fiscal)) e.regimen_fiscal = "Selecciona el régimen fiscal.";
  if (vacio(form.uso_cfdi_default)) e.uso_cfdi_default = "Selecciona el uso de CFDI.";
  if (vacio(form.forma_pago_default)) e.forma_pago_default = "Selecciona la forma de pago.";
  if (vacio(form.metodo_pago_default)) e.metodo_pago_default = "Selecciona el método de pago.";

  // Con RFC real la dirección es obligatoria para poder facturar.
  if (!e.rfc && !esRfcGenerico(rfc) && vacio(form.direccion)) {
    e.direccion = "Con RFC real la dirección fiscal es obligatoria.";
  }

  return e;
}

/** `true` cuando no hay ningún error pendiente. */
export function conversionClienteValida(form: ClienteFormData): boolean {
  return Object.keys(validarClienteConversion(form)).length === 0;
}
