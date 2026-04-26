import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useToast } from "@/hooks/use-toast";
import {
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAdminOrganizations, useCreateOrganization, type OrgRow } from "@/hooks/useAdminData";

export default function AdminOrganizaciones() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rfc, setRfc] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: orgs = [], isLoading } = useAdminOrganizations();

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
          className="text-primary hover:underline font-medium"
          onClick={() => navigate(`/admin/organizaciones/${o.id}`)}
        >
          {o.nombre}
        </button>
      ),
    },
    { key: "rfc", header: "RFC", width: "w-[140px]", render: (o) => o.rfc || "—" },
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
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Organizaciones</h1>
            <p className="text-sm text-muted-foreground">Gestiona las empresas que utilizan la plataforma.</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva Organización
        </Button>
      </div>

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={orgs}
          isLoading={isLoading}
          emptyMessage="No hay organizaciones registradas."
          rowKey={(o) => o.id}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
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
