/**
 * QuickAddMenu — botón "+ Nuevo" global del CRM con altas express.
 *
 * Cambio v13.746.0: las altas express dejan de ser Popovers anclados al menú y
 * pasan a ser modales estándar (FormDialogShell). El Popover anidado en el
 * DropdownMenu perdía la carrera contra el cierre del menú (Radix desmonta el
 * content y devuelve el foco en el mismo gesto), así que al dar clic en
 * "Nuevo lead" no pasaba nada. Un Dialog no depende del ancla ni del foco del
 * menú, por lo que el clic siempre abre el formulario.
 *
 * Atajos: N abre el menú; L/O/A abren directo el formulario correspondiente.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Target, Activity, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NuevoLeadDialog from "@/features/crm/components/NuevoLeadDialog";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import NuevaActividadDialog from "@/features/crm/components/NuevaActividadDialog";
import ImportarLeadsCsvDialog from "@/features/crm/components/ImportarLeadsCsvDialog";
import QuickCreateLeadDialog from "@/features/crm/components/quickCreate/QuickCreateLeadDialog";
import QuickCreateOportunidadDialog from "@/features/crm/components/quickCreate/QuickCreateOportunidadDialog";
import QuickCreateActividadDialog from "@/features/crm/components/quickCreate/QuickCreateActividadDialog";
import { usePermissions } from "@/hooks/shared";

export interface QuickAddMenuProps {
  openTrigger?: number;
  dialogTrigger?: { kind: "lead" | "oportunidad" | "actividad"; n: number };
}

type Quick = "lead" | "oportunidad" | "actividad" | null;

export default function QuickAddMenu({ openTrigger, dialogTrigger }: QuickAddMenuProps = {}) {
  const navigate = useNavigate();
  const { canEditCrm, canCrearLead } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quick, setQuick] = useState<Quick>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Ola 9 (v13.430.0): antes se usaba un ref booleano "primer render" para
  // ignorar el valor inicial de `openTrigger`. En StrictMode React monta,
  // desmonta y vuelve a montar: el ref ya estaba en `false` en el segundo
  // montaje, así que el menú "Nuevo" aparecía abierto solo, sin que nadie
  // presionara nada. Ahora comparamos contra el último valor visto, que es
  // idempotente ante remontajes.
  const lastOpenTrigger = useRef(openTrigger);
  useEffect(() => {
    if (openTrigger === undefined || openTrigger === lastOpenTrigger.current) return;
    lastOpenTrigger.current = openTrigger;
    setMenuOpen(true);
  }, [openTrigger]);

  const lastDialogTrigger = useRef(dialogTrigger?.n);
  useEffect(() => {
    if (!dialogTrigger || dialogTrigger.n === lastDialogTrigger.current) return;
    lastDialogTrigger.current = dialogTrigger.n;
    if (dialogTrigger.kind === "lead" && !canCrearLead) return;
    setQuick(dialogTrigger.kind);
  }, [dialogTrigger, canCrearLead]);

  const abrirQuick = (kind: Exclude<Quick, null>) => {
    // v13.823.60: el atajo "L" y el menú comparten el mismo candado de creación.
    if (kind === "lead" && !canCrearLead) return;
    setMenuOpen(false);
    setQuick(kind);
  };

  const cerrarQuick = (open: boolean) => { if (!open) setQuick(null); };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canCrearLead && (
            <DropdownMenuItem onSelect={() => abrirQuick("lead")}>
              <Users className="h-4 w-4 mr-2" /> Nuevo lead <span className="ml-auto text-label text-muted-foreground">L</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => abrirQuick("oportunidad")}>
            <Target className="h-4 w-4 mr-2" /> Nueva oportunidad <span className="ml-auto text-label text-muted-foreground">O</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => abrirQuick("actividad")}>
            <Activity className="h-4 w-4 mr-2" /> Nueva actividad <span className="ml-auto text-label text-muted-foreground">A</span>
          </DropdownMenuItem>
          {canEditCrm && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { setMenuOpen(false); setImportOpen(true); }}>
                <Upload className="h-4 w-4 mr-2" /> Importar leads CSV
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <QuickCreateLeadDialog
        open={quick === "lead"}
        onOpenChange={cerrarQuick}
        onCreated={(id) => navigate(`/crm/leads/${id}`)}
        onMore={() => { setQuick(null); setLeadOpen(true); }}
      />
      <QuickCreateOportunidadDialog
        open={quick === "oportunidad"}
        onOpenChange={cerrarQuick}
        onCreated={(id) => navigate(`/crm/oportunidades/${id}`)}
        onMore={() => { setQuick(null); setOpOpen(true); }}
      />
      <QuickCreateActividadDialog
        open={quick === "actividad"}
        onOpenChange={cerrarQuick}
        onCreated={() => navigate("/crm/actividades")}
        onMore={() => { setQuick(null); setActOpen(true); }}
      />

      <NuevoLeadDialog open={leadOpen} onOpenChange={setLeadOpen} onCreated={(id) => navigate(`/crm/leads/${id}`)} />
      <NuevaOportunidadDialog open={opOpen} onOpenChange={setOpOpen} onSaved={(id) => navigate(`/crm/oportunidades/${id}`)} />
      <NuevaActividadDialog open={actOpen} onOpenChange={setActOpen} onCreated={() => navigate("/crm/actividades")} />
      <ImportarLeadsCsvDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
