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
