/** Las cuentas inactivas o eliminadas no son opciones operativas de traspaso. */
export function cuentasActivasParaTraspaso<T extends { id: string; activa: boolean; deleted_at: string | null }>(cuentas: T[]): T[] {
  const vistas = new Set<string>();
  return cuentas.filter((c) => {
    if (!c.activa || c.deleted_at || vistas.has(c.id)) return false;
    vistas.add(c.id);
    return true;
  });
}
