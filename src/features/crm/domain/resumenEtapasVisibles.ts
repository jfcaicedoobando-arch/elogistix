/** Conteos del conjunto visible, sin reclasificar oportunidades huérfanas. */
export function resumenEtapasVisibles(
  oportunidades: { etapa_id: string | null }[],
  etapas: { id: string; tipo: "abierta" | "ganada" | "perdida" }[],
) {
  const tipos = new Map(etapas.map(e => [e.id, e.tipo]));
  const total = { abiertas: 0, ganadas: 0, perdidas: 0, sinEtapa: 0 };
  for (const op of oportunidades) {
    const tipo = op.etapa_id ? tipos.get(op.etapa_id) : undefined;
    if (tipo === "abierta") total.abiertas++;
    else if (tipo === "ganada") total.ganadas++;
    else if (tipo === "perdida") total.perdidas++;
    else total.sinEtapa++;
  }
  return total;
}
