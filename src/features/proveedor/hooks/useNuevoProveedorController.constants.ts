import type { Enums } from "@/integrations/supabase/types";

export type TipoProveedor = Enums<"tipo_proveedor">;
export type Moneda = Enums<"moneda">;
export type CategoriaProveedor = Enums<"categoria_proveedor">;
export type SubtipoGasto = Enums<"subtipo_gasto_operativo">;

export const DOCS_NACIONAL = [
  "CIF",
  "Opinión fiscal",
  "Acta constitutiva",
  "INE RL",
  "Poder notarial",
  "Comprobante de domicilio",
  "Datos bancarios",
];

export const DOCS_EXTRANJERO = [
  "Certificado de ID",
  "Comprobante de domicilio",
  "Documento que acredite su legalidad",
  "Identificación del RL",
  "Datos bancarios",
  "Poder notarial del RL",
];

export const EMPTY_PROVEEDOR_FORM = {
  nombre: "",
  categoria: "Logistico" as CategoriaProveedor | "",
  tipo: null as TipoProveedor | null,
  subtipo_gasto: null as SubtipoGasto | null,
  pais: "",
  rfc: "",
  contacto: "",
  email: "",
  telefono: "",
  moneda_preferida: "MXN" as Moneda,
  origen_proveedor: null as "Nacional" | "Extranjero" | null,
  // v13.315.8 (QW2) — días de crédito por defecto que heredarán las facturas
  // capturadas contra este proveedor.
  dias_credito: 0,
  // Datos fiscales (CSF) — opcionales, solo para registro interno.
  cp: "",
  direccion: "",
  ciudad: "",
  estado: "",
  regimen_fiscal: "",
  // Datos bancarios nacionales (paso 2) — opcionales.
  banco: "",
  clabe: "",
  // Datos bancarios internacionales (paso 2) — opcionales.
  banco_pais: "",
  swift_bic: "",
  iban: "",
  aba_routing: "",
  banco_direccion: "",
  banco_intermediario: "",
  banco_intermediario_swift: "",
  beneficiario: "",
  referencia_pago: "",
};

export type NuevoProveedorForm = typeof EMPTY_PROVEEDOR_FORM;
