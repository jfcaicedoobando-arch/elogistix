/** La lectura histórica no habilita operaciones. Sólo null confirma vigencia. */
export function esFacturaVigenteParaOperar(
  factura: { deleted_at?: string | null } | null | undefined,
): boolean {
  return factura?.deleted_at === null;
}
