/**
 * Selección masiva de leads visibles: se limpia al cambiar filtros/orden/
 * paginación y se poda cuando cambian las filas visibles.
 * Extraído de `Leads.tsx` (Power of 10 — límite de líneas por archivo).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CrmLeadRow } from "@/features/crm/domain/leads/constants";

interface SelKeyParts {
  search: string;
  estado: string;
  fuente: string;
  sortKey?: string;
  sortDir?: string;
  page: number;
  pageSize: number;
}

export function useLeadsSelection(leads: CrmLeadRow[], selKeyParts: SelKeyParts) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // La selección masiva vive SÓLO en el contexto visible: cualquier cambio de
  // filtros, orden o paginación la limpia para no operar sobre filas invisibles.
  const selKey = [
    selKeyParts.search, selKeyParts.estado, selKeyParts.fuente,
    selKeyParts.sortKey, selKeyParts.sortDir, selKeyParts.page, selKeyParts.pageSize,
  ].join("|");
  const selKeyRef = useRef(selKey);
  useEffect(() => {
    if (selKeyRef.current !== selKey) {
      selKeyRef.current = selKey;
      setSelected(new Set());
    }
  }, [selKey]);

  // Defensa adicional: al llegar nuevas filas se poda cualquier id ausente.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visibles = new Set(leads.map((l) => l.id));
      const podado = new Set(Array.from(prev).filter((id) => visibles.has(id)));
      return podado.size === prev.size ? prev : podado;
    });
  }, [leads]);

  const toggle = useCallback((id: string) => setSelected((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  }), []);
  const toggleAll = useCallback((rows: CrmLeadRow[]) => setSelected((s) => {
    const allHere = rows.every((r) => s.has(r.id));
    const n = new Set(s);
    if (allHere) rows.forEach((r) => n.delete(r.id));
    else rows.forEach((r) => n.add(r.id));
    return n;
  }), []);
  const clearSel = () => setSelected(new Set());

  return { selected, toggle, toggleAll, clearSel };
}
