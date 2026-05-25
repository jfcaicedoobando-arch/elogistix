/**
 * QuickAddMenu — botón "+ Nuevo" global del CRM con menú para crear
 * Lead, Oportunidad o Actividad sin navegar de pestaña.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Target, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NuevoLeadDialog from "@/components/crm/NuevoLeadDialog";
import NuevaOportunidadDialog from "@/components/crm/NuevaOportunidadDialog";
import NuevaActividadDialog from "@/components/crm/NuevaActividadDialog";

export default function QuickAddMenu() {
  const navigate = useNavigate();
  const [leadOpen, setLeadOpen] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setLeadOpen(true)}>
            <Users className="h-4 w-4 mr-2" /> Nuevo lead
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpOpen(true)}>
            <Target className="h-4 w-4 mr-2" /> Nueva oportunidad
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActOpen(true)}>
            <Activity className="h-4 w-4 mr-2" /> Nueva actividad
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NuevoLeadDialog open={leadOpen} onOpenChange={setLeadOpen} onCreated={(id) => navigate(`/crm/leads/${id}`)} />
      <NuevaOportunidadDialog open={opOpen} onOpenChange={setOpOpen} onSaved={(id) => navigate(`/crm/oportunidades/${id}`)} />
      <NuevaActividadDialog open={actOpen} onOpenChange={setActOpen} onCreated={() => navigate("/crm/actividades")} />
    </>
  );
}
