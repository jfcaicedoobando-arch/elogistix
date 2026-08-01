import type { Enums } from "@/integrations/supabase/types";

type TipoContacto = Enums<"tipo_contacto">;

export interface ContactoFormData {
  nombre: string;
  rfc: string;
  tipo: TipoContacto;
  pais: string;
  ciudad: string;
  direccion: string;
  contacto: string;
  email: string;
  telefono: string;
}

export interface ClienteFormData {
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
  regimen_fiscal: string;
  uso_cfdi_default: string;
  dias_credito: number | null;
  limite_credito_mxn: number | null;
  /** v13.386.0 — cuenta directa: sus embarques no generan comisión por defecto. */
  sin_comision: boolean;
}
