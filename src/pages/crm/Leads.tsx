/**
 * /crm/leads — Listado de leads con búsqueda, filtros, selección múltiple e import CSV.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/selects/SearchInput";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  DataTable,
  defineColumns,
  type ColumnDef,
} from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { useDebounce, useListPageState, usePermissions } from "@/hooks/shared";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { toTitleCase } from "@/lib/formatters";
import NuevoLeadDialog from "@/components/crm/NuevoLeadDialog";
import LeadsBulkBar from "@/components/crm/LeadsBulkBar";
import ImportarLeadsCsvDialog from "@/components/crm/ImportarLeadsCsvDialog";
import {
  LEAD_ESTADOS,
  LEAD_FUENTES,
  useLeads,
  type CrmLeadEstado,
  type CrmLeadFuente,
  type CrmLeadRow,
} from "@/hooks/crm/useLeads";

const ESTADO_VARIANT: Record<CrmLeadEstado, "default" | "secondary" | "outline" | "destructive"> = {
  Nuevo: "default",
  Contactado: "secondary",
  Calificado: "default",
  Descalificado: "destructive",
  Convertido: "outline",
};

function makeColumns(
  selected: Set<string>,
  toggle: (id: string) => void,
  toggleAll: (rows: CrmLeadRow[]) => void,
  allRows: CrmLeadRow[],
): ColumnDef<CrmLeadRow, unknown>[] {
  const allSelected = allRows.length > 0 && allRows.every((r) => selected.has(r.id));
  return defineColumns<CrmLeadRow>([
    {
      id: "sel", header: () => (
        <Checkbox checked={allSelected} onCheckedChange={() => toggleAll(allRows)} aria-label="Seleccionar todos" />
      ),
      meta: { width: "w-[40px]" },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(row.original.id)} onCheckedChange={() => toggle(row.original.id)} />
        </div>
      ),
    },
    {
      id: "empresa", header: "Empresa",
      accessorFn: (l) => l.empresa, enableSorting: true,
      sortingFn: sortByString<CrmLeadRow>((l) => l.empresa),
      meta: { width: "min-w-[180px]", className: "font-medium" },
      cell: ({ row }) => toTitleCase(row.original.empresa),
    },
    { id: "contacto", header: "Contacto", meta: { width: "w-[160px]", className: "text-xs" }, cell: ({ row }) => toTitleCase(row.original.contacto ?? "") },
    { id: "email", header: "Email", meta: { width: "w-[200px]", className: "text-xs truncate" }, cell: ({ row }) => row.original.email ?? "" },
    { id: "fuente", header: "Fuente", meta: { width: "w-[120px]", className: "text-xs" }, cell: ({ row }) => row.original.fuente },
    {
      id: "estado", header: "Estado", meta: { width: "w-[120px]" },
      cell: ({ row }) => <Badge variant={ESTADO_VARIANT[row.original.estado]}>{row.original.estado}</Badge>,
    },
    { id: "score", header: "Score", meta: { width: "w-[60px]", className: "text-center text-xs" }, cell: ({ row }) => row.original.score },
  ]);
}

export default function Leads() {
  const navigate = useNavigate();
  const { canEdit, canEditCrm } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { search, setSearch, page, setPage, pageSize, setPageSize } = useListPageState({});
  const debounced = useDebounce(search, 300);
  const [estado, setEstado] = useState<CrmLeadEstado | "todos">("todos");
  const [fuente, setFuente] = useState<CrmLeadFuente | "todos">("todos");

  const { data, isLoading } = useLeads({ search: debounced, estado, fuente, page, pageSize });
  const leads = data?.data ?? [];
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
  const columns = useMemo(() => makeColumns(selected, toggle, toggleAll, leads), [selected, leads]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={<Users className="h-6 w-6 text-accent" />}
        title="Leads"
        description={`${totalCount} leads en cartera`}
        actions={
          canEdit ? (
            <div className="flex gap-2">
              {canEditCrm && (
                <Button variant="outline" onClick={() => setImportOpen(true)} className="hidden md:flex">
                  <Upload className="h-4 w-4 mr-1" /> Importar CSV
                </Button>
              )}
              <Button onClick={() => setDialogOpen(true)} className="hidden md:flex">
                <Plus className="h-4 w-4 mr-1" /> Nuevo lead
              </Button>
            </div>
          ) : null
        }
      />

      {canEditCrm && selected.size > 0 && (
        <LeadsBulkBar ids={Array.from(selected)} onClear={clearSel} onDone={clearSel} />
      )}

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
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
            }}
          />
        </CardContent>
      </Card>

      <NuevoLeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/crm/leads/${id}`)}
      />

      <ImportarLeadsCsvDialog open={importOpen} onOpenChange={setImportOpen} />

      {canEdit && (
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo lead"
          onClick={() => setDialogOpen(true)}
        />
      )}
    </div>
  );
}
