/** Agrupa las filas del RPC `broker_mis_empresas` por empresa. */
export interface FilaBrokerEmpresa {
  empresa_id: string;
  empresa: string;
  estado_crm: string;
  organizacion: string;
  oportunidad: string | null;
  etapa: string | null;
  etapa_tipo: string | null;
  actualizado: string | null;
}

export interface EmpresaBroker {
  id: string;
  nombre: string;
  estado: string;
  organizacion: string;
  oportunidades: { nombre: string; etapa: string; tipo: string | null }[];
}

export function agruparEmpresas(filas: readonly FilaBrokerEmpresa[]): EmpresaBroker[] {
  const mapa = new Map<string, EmpresaBroker>();
  for (const f of filas) {
    let e = mapa.get(f.empresa_id);
    if (!e) {
      e = { id: f.empresa_id, nombre: f.empresa, estado: f.estado_crm, organizacion: f.organizacion, oportunidades: [] };
      mapa.set(f.empresa_id, e);
    }
    if (f.oportunidad) {
      e.oportunidades.push({ nombre: f.oportunidad, etapa: f.etapa ?? "Sin etapa", tipo: f.etapa_tipo });
    }
  }
  return [...mapa.values()];
}
