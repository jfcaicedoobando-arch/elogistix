/**
 * Consulta de leads duplicados vía RPC `crm_leads_buscar_duplicados`
 * (v13.630.0 — Ola A CRM). Conserva los filtros de la RPC y nunca publica
 * resultados parciales como una revisión terminada.
 */
import { supabase } from "@/integrations/supabase/client";
import type { LeadClave, LeadExistente } from "@/features/crm/domain/leadsDedupe";
import { normEmpresa, normEmail, normTelefono } from "@/features/crm/domain/leadsDedupe";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

const MAX_CLAVES_LOTE = 500;
// Por debajo de api.max_rows (10000); el conteo detecta también topes menores.
const TAM_PAGINA = 500;
const MAX_PAGINAS_LOTE = 200;

function validarPagina<T>(
  data: T[] | null, count: number | null, total: number | undefined, offset: number,
) {
  if (data === null || count === null || !Number.isSafeInteger(count) || count < 0 ||
      (total !== undefined && count !== total) || data.length > TAM_PAGINA ||
      offset + data.length > count || (data.length === 0 && offset < count)) {
    throw new Error("No se pudo completar la revisión de duplicados. Reintenta.");
  }
  return { filas: data, total: count };
}

export async function buscarLeadsDuplicados(
  claves: ReadonlyArray<LeadClave>,
): Promise<LeadExistente[]> {
  const scope = captureAuthOperationScope();
  const vistas = new Set<string>();
  const utiles = claves
    .filter((c) => c.empresa || c.email || c.telefono)
    .filter((c) => {
      const key = JSON.stringify([
        normEmpresa(c.empresa), normEmail(c.email), normTelefono(c.telefono).slice(-10),
      ]);
      if (vistas.has(key)) return false;
      vistas.add(key);
      return true;
    })
    .map((c) => ({
      empresa: c.empresa ?? "",
      email: c.email ?? "",
      telefono: c.telefono ?? "",
    }));
  if (utiles.length === 0) return [];

  const existentes = new Map<string, LeadExistente>();
  for (let inicio = 0; inicio < utiles.length; inicio += MAX_CLAVES_LOTE) {
    const lote = utiles.slice(inicio, inicio + MAX_CLAVES_LOTE);
    const idsLote = new Set<string>();
    let offset = 0;
    let total: number | undefined;
    for (let pagina = 0; pagina < MAX_PAGINAS_LOTE; pagina++) {
      scope.assertCurrent();
      const { data, error, count } = await supabase
        .rpc("crm_leads_buscar_duplicados", { p_claves: lote }, { count: "exact" })
        .order("id", { ascending: true })
        .range(offset, offset + TAM_PAGINA - 1);
      scope.assertCurrent();
      if (error) throw error;
      const respuesta = validarPagina(data, count, total, offset);
      total = respuesta.total;
      for (const r of respuesta.filas) {
        if (idsLote.has(r.id)) {
          throw new Error("La revisión de duplicados devolvió una página repetida. Reintenta.");
        }
        idsLote.add(r.id);
        existentes.set(r.id, {
          id: r.id, empresa: r.empresa, contacto: r.contacto,
          email: r.email, telefono: r.telefono, estado: r.estado,
        });
      }
      // Avanzar por las filas recibidas, incluso si el servidor acorta la página.
      offset += respuesta.filas.length;
      if (offset === total) break;
    }
    if (offset !== total) {
      throw new Error("La revisión de duplicados excedió el límite de páginas. Reduce el archivo y reintenta.");
    }
  }
  scope.assertCurrent();
  return [...existentes.values()];
}
