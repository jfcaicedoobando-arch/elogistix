/**
 * Valores iniciales del alta de proveedor cuando llegan datos detectados en un
 * documento (CFDI o PDF con IA) desde la captura de facturas de proveedor.
 */
import {
  EMPTY_PROVEEDOR_FORM,
  type NuevoProveedorForm,
} from "./useNuevoProveedorController.constants";

export interface PrefillProveedor {
  nombre?: string;
  rfc?: string;
}

export function formInicialProveedor(prefill?: PrefillProveedor): NuevoProveedorForm {
  return {
    ...EMPTY_PROVEEDOR_FORM,
    ...(prefill?.nombre ? { nombre: prefill.nombre } : {}),
    ...(prefill?.rfc ? { rfc: prefill.rfc.toUpperCase() } : {}),
  };
}
