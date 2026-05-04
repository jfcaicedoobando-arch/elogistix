import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, MoreHorizontal, Eye, Power } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { Label } from "@/components/ui/label";
import { dialogSize } from "@/lib/ui/dialogTokens";
import { useNavigate } from "react-router-dom";
import { useAdminOrganizations, useCreateOrganization, type OrgRow } from "@/hooks/admin/useAdminData";
import { toTitleCase } from "@/lib/formatters";

export default function AdminOrganizaciones() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rfc, setRfc] = useState("");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("todos");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: orgs = [], isLoading } = useAdminOrganizations();

  const planes = useMemo(
    () => Array.from(new Set(orgs.map((o) => o.plan).filter(Boolean))).sort(),
    [orgs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgs.filter((o) => {
      if (planFilter !== "todos" && o.plan !== planFilter) return false;
      if (estadoFilter === "activas" && !o.activo) return false;
      if (estadoFilter === "inactivas" && o.activo) return false;
      if (q && !o.nombre.toLowerCase().includes(q) && !o.rfc?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orgs, search, planFilter, estadoFilter]);

  const createOrg = useCreateOrganization();

  const handleCreate = () => {
    createOrg.mutate({ nombre, rfc }, {
      onSuccess: () => {
        notifySuccess(toast, { title: "Organización creada" });
        setDialogOpen(false);
        setNombre("");
        setRfc("");
      },
      onError: (err: Error) => {
        notifyError(toast, { title: "Error", description: err.message});
      },
    });
  };

  const columns: DataTableColumn<OrgRow>[] = [
    {
      key: "nombre",
      header: "Nombre",
      width: "min-w-[200px]",
      className: "font-medium",
      sortable: true,
      sortValue: (o) => o.nombre,
      render: (o) => (
        <button
          className="text-primary hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          onClick={() => navigate(`/admin/organizaciones/${o.id}`)}
          title={o.nombre}
        >
          {toTitleCase(o.nombre)}
        </button>
      ),
    },
    { key: "rfc", header: "RFC", width: "w-[140px]", render: (o) => o.rfc?.toUpperCase() || "—" },
    { key: "plan", header: "Plan", width: "w-[100px]", render: (o) => <Badge variant="outline">{o.plan}</Badge> },
    {
      key: "activo",
      header: "Estado",
      width: "w-[100px]",
      render: (o) => (
        <Badge variant={o.activo ? "success" : "neutral"}>
          {o.activo ? "Activa" : "Inactiva"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-[60px]",
      align: "right",
      render: (o) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Acciones para ${o.nombre}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => navigate(`/admin/organizaciones/${o.id}`)}>
              <Eye className="h-4 w-4 mr-2" /> Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Power className="h-4 w-4 mr-2" /> {o.activo ? "Desactivar" : "Activar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Building2 className="h-6 w-6 text-primary" />}
        title="Organizaciones"
        description={`${filtered.length} de ${orgs.length} empresas en la plataforma.`}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva Organización
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RFC…"
            className="pl-8"
            aria-label="Buscar organizaciones"
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filtrar por plan">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los planes</SelectItem>
            {planes.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="activas">Activas</SelectItem>
            <SelectItem value="inactivas">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          emptyMessage="No se encontraron organizaciones con los filtros aplicados."
          rowKey={(o) => o.id}
          density="comfortable"
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={dialogSize.md}>
          <DialogHeader>
            <DialogTitle>Nueva Organización</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la empresa" />
            </div>
            <div>
              <Label>RFC</Label>
              <Input value={rfc} onChange={(e) => setRfc(e.target.value)} placeholder="RFC (opcional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nombre.trim() || createOrg.isPending}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
