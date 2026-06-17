import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Pencil, Save, X } from "lucide-react";
import { formatDate } from "@/lib/formatters";

interface PlanOption { id: string; nombre: string; activo: boolean }

interface OrgInfoCardProps {
  org: { nombre: string; rfc: string | null; plan: string | null; created_at: string | null };
  planes: PlanOption[];
  editing: boolean;
  setEditing: (v: boolean) => void;
  editNombre: string; setEditNombre: (v: string) => void;
  editRfc: string; setEditRfc: (v: string) => void;
  editPlan: string; setEditPlan: (v: string) => void;
  savePending: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function OrgInfoCard({
  org, planes, editing, setEditing,
  editNombre, setEditNombre, editRfc, setEditRfc, editPlan, setEditPlan,
  savePending, onSave, onCancel,
}: OrgInfoCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Información general
        </CardTitle>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="default" size="sm" className="gap-1"
              disabled={savePending || !editNombre.trim()}
              onClick={onSave}
            >
              <Save className="h-3.5 w-3.5" /> Guardar
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Nombre</p>
            {editing
              ? <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} maxLength={100} />
              : <p className="font-medium">{org.nombre}</p>}
          </div>
          <div>
            <p className="text-muted-foreground mb-1">RFC</p>
            {editing
              ? <Input value={editRfc} onChange={(e) => setEditRfc(e.target.value.toUpperCase())} maxLength={13} />
              : <p className="font-medium">{org.rfc || "—"}</p>}
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
            <p className="font-medium">{org.created_at ? formatDate(org.created_at, "dd MMM yyyy") : "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
