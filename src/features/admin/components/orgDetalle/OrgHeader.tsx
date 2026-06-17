import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Building2, CheckCircle2, XCircle } from "lucide-react";

interface OrgHeaderProps {
  nombre: string;
  rfc: string | null;
  plan: string | null;
  activo: boolean;
  toggleActivoPending: boolean;
  onToggleActivo: (next: boolean) => void;
}

export function OrgHeader({ nombre, rfc, plan, activo, toggleActivoPending, onToggleActivo }: OrgHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => navigate("/admin/organizaciones")} aria-label="Volver a organizaciones">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Building2 className="h-6 w-6 text-primary" />
      <div className="flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{nombre}</h1>
        <p className="text-sm text-muted-foreground">RFC: {rfc || "—"} · Plan: {plan}</p>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={activo} onCheckedChange={onToggleActivo} disabled={toggleActivoPending} />
        <Badge variant={activo ? "default" : "secondary"} className="gap-1">
          {activo ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {activo ? "Activo" : "Inactivo"}
        </Badge>
      </div>
    </div>
  );
}
