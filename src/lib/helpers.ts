// Barrel mínimo para backward compatibility.
// Las funciones canónicas están en formatters.ts y uiMappings.ts.

export { formatDate } from "@/lib/formatters";
export { getEstadoColor, getModoIcon } from "@/lib/uiMappings";

export const resolverContacto = (
  contactos: Array<{ id: string; nombre: string; tipo: string; pais: string }>,
  valor: string,
  valorManual: string
): string => {
  if (valor === '__otro__') return valorManual.trim();
  const contacto = contactos.find(c => c.id === valor);
  return contacto ? `${contacto.nombre} — ${contacto.tipo} (${contacto.pais})` : valor;
};
