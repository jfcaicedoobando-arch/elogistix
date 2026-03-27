import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

interface OrgRow {
  id: string;
  nombre: string;
  rfc: string;
  plan: string;
  activo: boolean;
  created_at: string;
}

export default function AdminOrganizaciones() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rfc, setRfc] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: queryKeys.admin.organizations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data as unknown as OrgRow[];
    },
  });

  const createOrg = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("organizations").insert({ nombre, rfc });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      toast({ title: "Organización creada" });
      setDialogOpen(false);
      setNombre("");
      setRfc("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

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
        <Badge className={o.activo ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}>
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
            <Button onClick={() => createOrg.mutate()} disabled={!nombre.trim() || createOrg.isPending}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
