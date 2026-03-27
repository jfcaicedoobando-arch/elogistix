import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { KpiCard } from "@/components/operaciones/KpiCard";
import { useConfiguracionByOrg } from "@/hooks/useConfiguracionOrg";
import { usePlanes } from "@/hooks/usePlanes";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Building2, Users, Ship, UserCheck, FileText, Calendar, CheckCircle2, XCircle, Settings, Pencil, Save, X, UserPlus, Trash2 } from "lucide-react";
import AgregarMiembroOrgDialog from "@/components/admin/AgregarMiembroOrgDialog";
import type { Enums } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type AppRole = Enums<"app_role">;

interface MemberRow {
  id: string;
  user_id: string;
  role: AppRole;
  email?: string;
}

export default function AdminOrgDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editRfc, setEditRfc] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // Planes
  const { data: planes = [] } = usePlanes();

  // Org data
  const { data: org } = useQuery({
    queryKey: ["admin-org", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (org) {
      setEditNombre(org.nombre);
      setEditRfc(org.rfc ?? "");
      setEditPlan(org.plan ?? "basic");
    }
  }, [org]);

  // Update org mutation
  const updateOrg = useMutation({
    mutationFn: async (payload: { nombre: string; rfc: string; plan: string }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ nombre: payload.nombre, rfc: payload.rfc, plan: payload.plan })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-org", id] });
      toast({ title: "Organización actualizada" });
      setEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: async (activo: boolean) => {
      const { error } = await supabase
        .from("organizations")
        .update({ activo })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_, activo) => {
      queryClient.invalidateQueries({ queryKey: ["admin-org", id] });
      toast({ title: activo ? "Organización activada" : "Organización desactivada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // KPI counts
  const { data: memberCount = 0 } = useQuery({
    queryKey: ["admin-org-count-members", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: embarqueCount = 0 } = useQuery({
    queryKey: ["admin-org-count-embarques", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("embarques")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: clienteCount = 0 } = useQuery({
    queryKey: ["admin-org-count-clientes", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: cotizacionCount = 0 } = useQuery({
    queryKey: ["admin-org-count-cotizaciones", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cotizaciones")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });

  // Members
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["admin-org-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role")
        .eq("organization_id", id!)
        .order("created_at");
      if (error) throw error;

      let emailMap: Record<string, string> = {};
      try {
        const { data: usersData } = await supabase.functions.invoke("list-users");
        if (Array.isArray(usersData)) {
          usersData.forEach((u: { id: string; email: string }) => {
            emailMap[u.id] = u.email;
          });
        }
      } catch { /* */ }

      return (data ?? []).map((m) => ({
        ...m,
        email: emailMap[m.user_id] || m.user_id,
      })) as MemberRow[];
    },
    enabled: !!id,
  });

  // Config
  const { data: configItems = [], isLoading: loadingConfig } = useConfiguracionByOrg(id ?? null);

  const grouped = configItems.reduce<Record<string, typeof configItems>>((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {});

  // Mutations
  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("organization_members")
        .update({ role })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-org-members", id] });
      toast({ title: "Rol actualizado" });
    },
  });

  const roleBadge: Record<string, string> = {
    super_admin: "bg-primary text-primary-foreground",
    admin: "bg-destructive text-destructive-foreground",
    operador: "bg-info text-info-foreground",
    viewer: "bg-muted text-muted-foreground",
  };

  const columns: DataTableColumn<MemberRow>[] = [
    { key: "email", header: "Usuario", width: "min-w-[200px]", className: "font-medium", render: (m) => m.email ?? m.user_id },
    { key: "role", header: "Rol", width: "w-[100px]", render: (m) => <Badge className={roleBadge[m.role] ?? ""}>{m.role}</Badge> },
    {
      key: "change_role",
      header: "Cambiar rol",
      width: "w-[160px]",
      render: (m) => (
        <Select value={m.role} onValueChange={(val) => updateRole.mutate({ memberId: m.id, role: val as AppRole })}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="operador">Operador</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
  ];

  if (!org) return null;

  const isActive = org.activo !== false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/organizaciones")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Building2 className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{org.nombre}</h1>
          <p className="text-sm text-muted-foreground">RFC: {org.rfc || "—"} · Plan: {org.plan}</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => toggleActivo.mutate(checked)}
            disabled={toggleActivo.isPending}
          />
          <Badge variant={isActive ? "default" : "secondary"} className="gap-1">
            {isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {isActive ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard titulo="Miembros" valor={memberCount} icono={Users} color="blue" />
        <KpiCard titulo="Embarques" valor={embarqueCount} icono={Ship} color="violet" />
        <KpiCard titulo="Clientes" valor={clienteCount} icono={UserCheck} color="emerald" />
        <KpiCard titulo="Cotizaciones" valor={cotizacionCount} icono={FileText} color="red" />
      </div>

      {/* Info general */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Información general
          </CardTitle>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="gap-1"
                disabled={updateOrg.isPending || !editNombre.trim()}
                onClick={() => updateOrg.mutate({ nombre: editNombre.trim(), rfc: editRfc.trim(), plan: editPlan })}
              >
                <Save className="h-3.5 w-3.5" /> Guardar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); if (org) { setEditNombre(org.nombre); setEditRfc(org.rfc ?? ""); setEditPlan(org.plan ?? "basic"); } }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Nombre</p>
              {editing ? (
                <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} maxLength={100} />
              ) : (
                <p className="font-medium">{org.nombre}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground mb-1">RFC</p>
              {editing ? (
                <Input value={editRfc} onChange={(e) => setEditRfc(e.target.value.toUpperCase())} maxLength={13} />
              ) : (
                <p className="font-medium">{org.rfc || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Plan</p>
              {editing ? (
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {planes.filter(p => p.activo).map((p) => (
                      <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                    ))}
                    {planes.length === 0 && (
                      <>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline">{org.plan ?? "basic"}</Badge>
              )}
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Fecha de creación</p>
              <p className="font-medium">
                {org.created_at ? format(new Date(org.created_at), "dd MMM yyyy", { locale: es }) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Miembros */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Miembros ({members.length})
          </CardTitle>
          <Button size="sm" className="gap-1" onClick={() => setAddMemberOpen(true)}>
            <UserPlus className="h-4 w-4" /> Agregar miembro
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={members}
            isLoading={loadingMembers}
            emptyMessage="Sin miembros."
            rowKey={(m) => m.id}
          />
        </CardContent>
      </Card>

      {/* Configuración */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Configuración
          </CardTitle>
          <CardDescription>Parámetros de configuración de esta organización</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConfig && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {!loadingConfig && configItems.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin configuración personalizada.</p>
          )}
          {Object.entries(grouped).map(([categoria, items]) => (
            <div key={categoria} className="mb-4 space-y-2">
              <h4 className="text-sm font-semibold capitalize text-muted-foreground">{categoria}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{item.clave.replace(/_/g, " ")}</p>
                        {item.descripcion && <p className="text-xs text-muted-foreground">{item.descripcion}</p>}
                      </div>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {typeof item.valor === "string" ? item.valor : JSON.stringify(item.valor)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {id && (
        <AgregarMiembroOrgDialog
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          organizationId={id}
          existingUserIds={members.map((m) => m.user_id)}
          onAdded={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-org-members", id] });
            queryClient.invalidateQueries({ queryKey: ["admin-org-count-members", id] });
          }}
        />
      )}
    </div>
  );
}
