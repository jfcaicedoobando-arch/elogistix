/**
 * /crm/leads — Listado de leads con búsqueda, filtros y selección múltiple.
 * Sin botón "Nuevo lead" propio (vive en QuickAddMenu del header global).
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/selects/SearchInput";
import { DataTable } from "@/components/shared/DataTable";
import { useDebounce, useListPageState, usePermissions } from "@/hooks/shared";
import { CrmSubheader } from "@/components/crm/CrmSubheader";
import LeadsBulkBar from "@/components/crm/LeadsBulkBar";
import {
  LEAD_ESTADOS, LEAD_FUENTES, useLeads,
  type CrmLeadEstado, type CrmLeadFuente, type CrmLeadRow,
} from "@/hooks/crm";
import { makeLeadsColumns } from "./leadsColumns";

export default function Leads() {
  const navigate = useNavigate();
  const { canEditCrm } = usePermissions();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { search, setSearch, page, setPage, pageSize, setPageSize } = useListPageState({});
  const debounced = useDebounce(search, 300);
  const [estado, setEstado] = useState<CrmLeadEstado | "todos">("todos");
  const [fuente, setFuente] = useState<CrmLeadFuente | "todos">("todos");

  const { data, isLoading } = useLeads({ search: debounced, estado, fuente, page, pageSize });
  const leads = useMemo(() => data?.data ?? [], [data]);
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const toggleAll = (rows: CrmLeadRow[]) => setSelected((s) => {
    const allHere = rows.every((r) => s.has(r.id));
    const n = new Set(s);
    if (allHere) rows.forEach((r) => n.delete(r.id));
    else rows.forEach((r) => n.add(r.id));
    return n;
  });
  const clearSel = () => setSelected(new Set());
  const columns = useMemo(() => makeLeadsColumns(selected, toggle, toggleAll, leads), [selected, leads]);

  return (
    <div className="space-y-4 p-6">
      <CrmSubheader context={`${totalCount} leads en cartera`} />

      {canEditCrm && selected.size > 0 && (
        <LeadsBulkBar ids={Array.from(selected)} onClear={clearSel} onDone={clearSel} />
      )}

      <Card>
        <CardContent className="p-3 flex flex-col md:flex-row gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por empresa, contacto o email..."
          />
          <Select value={estado} onValueChange={(v) => { setEstado(v as typeof estado); setPage(0); }}>
            <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {LEAD_ESTADOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fuente} onValueChange={(v) => { setFuente(v as typeof fuente); setPage(0); }}>
            <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Fuente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las fuentes</SelectItem>
              {LEAD_FUENTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={leads}
            isLoading={isLoading}
            emptyMessage={debounced ? "No se encontraron leads" : "No hay leads registrados"}
            onRowClick={(l) => navigate(`/crm/leads/${l.id}`)}
            rowKey={(l) => l.id}
            density="comfortable"
            pagination={{
              page,
              totalPages,
              onPageChange: setPage,
              pageSize,
              onPageSizeChange: (s) => { setPageSize(s); setPage(0); },
              pageSizeOptions: [100, 999999],
              pageSizeLabels: { 999999: "Todos" },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
