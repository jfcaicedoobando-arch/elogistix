/** Resuelve un contacto por su ID o devuelve el valor manual si es '__otro__'. */
export const resolverContacto = (
  contactos: Array<{ id: string; nombre: string; tipo: string; pais: string }>,
  valor: string,
  valorManual: string
): string => {
  if (valor === '__otro__') return valorManual.trim();
  const contacto = contactos.find(c => c.id === valor);
  return contacto ? `${contacto.nombre} — ${contacto.tipo} (${contacto.pais})` : valor;
};

export interface ValorContactoResuelto {
  value: string;
  manual: string;
}

/**
 * Resolución inversa: dado el string guardado en BD (ej. "Nombre — Tipo (País)"
 * o el nombre del cliente), devuelve el value que esperan los <Select> del
 * wizard de embarques (`contacto.id`, `'__cliente__'` o `'__otro__'`).
 *
 * Usado al precargar el formulario de edición.
 */
export const resolverValorContactoDesdeTexto = (
  stored: string | null | undefined,
  contactos: Array<{ id: string; nombre: string; tipo: string; pais: string }>,
  clienteNombre: string | null | undefined,
  opciones: { permitirCliente: boolean } = { permitirCliente: false },
): ValorContactoResuelto => {
  const texto = (stored ?? '').trim();
  if (!texto) return { value: '', manual: '' };
  if (opciones.permitirCliente && clienteNombre && texto === clienteNombre.trim()) {
    return { value: '__cliente__', manual: '' };
  }
  const match = contactos.find(c => {
    const full = `${c.nombre} — ${c.tipo} (${c.pais})`;
    return full === texto || c.nombre === texto;
  });
  if (match) return { value: match.id, manual: '' };
  return { value: '__otro__', manual: texto };
};
