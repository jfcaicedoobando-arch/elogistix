/**
 * Tipos compartidos del módulo `vincularCotizacion`.
 *
 * v13.664.0: los helpers de dedupe/etapa/update se eliminaron al centralizar
 * el vínculo en la RPC transaccional `crm_vincular_cotizacion` (la lógica de
 * deduplicación por email y por razón social vive ahora en la base de datos).
 */

export interface AuthLite { id?: string; email?: string }

export interface ProspectoData {
  empresa: string;
  contacto: string;
  email: string;
  telefono: string;
  /** Datos fiscales opcionales capturados en el Paso 1 (viajan al lead). */
  rfc?: string;
  direccion?: string;
  ciudad?: string;
  entidadFederativa?: string;
  cp?: string;
}
