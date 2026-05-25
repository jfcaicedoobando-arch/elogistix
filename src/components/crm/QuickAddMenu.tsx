/**
 * QuickAddMenu — botón "+ Nuevo" global del CRM con menú para crear
 * Lead, Oportunidad o Actividad sin navegar de pestaña, y también
 * importar leads desde CSV.
 *
 * Soporta apertura programática vía `openTrigger` (un número que cambia
 * para forzar apertura) — usado por los atajos de teclado (`n`).
 *
 * Soporta apertura directa de cada diálogo vía `dialogTrigger` —
 * usado por los atajos `l/o/a`.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Target, Activity, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NuevoLeadDialog from "@/components/crm/NuevoLeadDialog";
import NuevaOportunidadDialog from "@/components/crm/NuevaOportunidadDialog";
import NuevaActividadDialog from "@/components/crm/NuevaActividadDialog";
import ImportarLeadsCsvDialog from "@/components/crm/ImportarLeadsCsvDialog";
import { usePermissions } from "@/hooks/shared";

export interface QuickAddMenuProps {
  /** Cambia el valor para abrir el menú desde fuera (hotkey `n`). */
  openTrigger?: number;
  /** Cambia el valor para abrir un diálogo concreto desde fuera (hotkeys l/o/a). */
  dialogTrigger?: { kind: "lead" | "oportunidad" | "actividad"; n: number };
}

export default function QuickAddMenu({ openTrigger, dialogTrigger }: QuickAddMenuProps = {}) {
  const navigate = useNavigate();
  const { canEditCrm } = usePermissions();
  const [open, setOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (openTrigger === undefined) return;
    setOpen(true);
  }, [openTrigger]);

  useEffect(() => {
    if (!dialogTrigger) return;
    if (dialogTrigger.kind === "lead") setLeadOpen(true);
    else if (dialogTrigger.kind === "oportunidad") setOpOpen(true);
    else if (dialogTrigger.kind === "actividad") setActOpen(true);
  }, [dialogTrigger]);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setLeadOpen(true)}>
            <Users className="h-4 w-4 mr-2" /> Nuevo lead <span className="ml-auto text-[10px] text-muted-foreground">L</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpOpen(true)}>
            <Target className="h-4 w-4 mr-2" /> Nueva oportunidad <span className="ml-auto text-[10px] text-muted-foreground">O</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActOpen(true)}>
            <Activity className="h-4 w-4 mr-2" /> Nueva actividad <span className="ml-auto text-[10px] text-muted-foreground">A</span>
          </DropdownMenuItem>
          {canEditCrm && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Importar leads CSV
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <NuevoLeadDialog open={leadOpen} onOpenChange={setLeadOpen} onCreated={(id) => navigate(`/crm/leads/${id}`)} />
      <NuevaOportunidadDialog open={opOpen} onOpenChange={setOpOpen} onSaved={(id) => navigate(`/crm/oportunidades/${id}`)} />
      <NuevaActividadDialog open={actOpen} onOpenChange={setActOpen} onCreated={() => navigate("/crm/actividades")} />
      <ImportarLeadsCsvDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
