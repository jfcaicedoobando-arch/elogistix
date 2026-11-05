export type TipoCliente = "general" | "especial";

export const TIPOS_CLIENTE: ReadonlyArray<{ value: TipoCliente; label: string }> = [
  { value: "general", label: "Cliente general" },
  { value: "especial", label: "Cliente especial" },
];

/** Cualquier valor desconocido o vacío se trata como cliente general. */
export function normalizarTipoCliente(v: unknown): TipoCliente {
  return v === "especial" ? "especial" : "general";
}
