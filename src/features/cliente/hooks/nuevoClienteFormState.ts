import type { CsfParsedData } from "@/features/cliente/services/csf";
import { cpLooksValid, emailLooksValid, rfcLooksValid } from "@/features/cliente/components/nuevoClienteValidators";
import { normalizarRazonSocial } from "@/lib/text/razonSocial";
import type { ClienteForm } from "./useNuevoClienteController.constants";

// B-024: email/teléfono/contacto son NOT NULL; el correo debe tener forma válida
// antes de avanzar al paso 2, además de los campos fiscales obligatorios.
export function isClienteStep1Valid(form: ClienteForm): boolean {
  return Boolean(
    form.nombre.trim() &&
    rfcLooksValid(form.rfc) &&
    cpLooksValid(form.cp) &&
    form.regimen_fiscal.trim() &&
    form.uso_cfdi_default.trim() &&
    form.forma_pago_default.trim() &&
    form.metodo_pago_default.trim() &&
    emailLooksValid(form.email) &&
    form.telefono.trim() &&
    form.contacto.trim()
  );
}

/** Aplica sólo los datos extraídos no vacíos y conserva la captura manual. */
export function mergeClienteCsf(prev: ClienteForm, datos: CsfParsedData): ClienteForm {
  return {
    ...prev,
    nombre: normalizarRazonSocial(datos.nombre) || prev.nombre,
    rfc: datos.rfc || prev.rfc,
    cp: datos.cp || prev.cp,
    direccion: datos.direccion || prev.direccion,
    ciudad: datos.ciudad || prev.ciudad,
    estado: datos.estado || prev.estado,
    regimen_fiscal: datos.regimen_fiscal || prev.regimen_fiscal,
  };
}
