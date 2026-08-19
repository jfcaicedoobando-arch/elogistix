/**
 * Tipos de la configuración por organización y global.
 *
 * Ola 20 · paso 4: separados de los servicios para que importar un tipo no
 * arrastre el cliente de base de datos.
 */

export interface ConfigItem {
  id: string;
  categoria: string;
  clave: string;
  valor: unknown;
  descripcion: string;
  organization_id?: string;
}

export interface ConfigGlobalItem {
  id: string;
  categoria: string;
  clave: string;
  valor: unknown;
  descripcion: string;
}

export type ConfigTable = "configuracion" | "configuracion_global";
