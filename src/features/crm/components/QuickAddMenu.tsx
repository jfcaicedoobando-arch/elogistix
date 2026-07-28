/**
 * QuickAddMenu — botón "+ Nuevo" global del CRM con popovers express.
 *
 * Cambio v11.50.0: cada opción abre un Popover inline de 2 campos en lugar
 * de un Dialog. "Más campos →" abre el dialog completo cuando se necesita.
 *
 * Atajos: N abre el menú; L/O/A abren directo el popover correspondiente.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Target, Activity, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import NuevoLeadDialog from "@/features/crm/components/NuevoLeadDialog";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import NuevaActividadDialog from "@/features/crm/components/NuevaActividadDialog";
import ImportarLeadsCsvDialog from "@/features/crm/components/ImportarLeadsCsvDialog";
import QuickCreateLeadPopover from "@/features/crm/components/quickCreate/QuickCreateLeadPopover";
import QuickCreateOportunidadPopover from "@/features/crm/components/quickCreate/QuickCreateOportunidadPopover";
import QuickCreateActividadPopover from "@/features/crm/components/quickCreate/QuickCreateActividadPopover";
import { usePermissions } from "@/hooks/shared";

export interface QuickAddMenuProps {
  openTrigger?: number;
  dialogTrigger?: { kind: "lead" | "oportunidad" | "actividad"; n: number };
}

type Quick = "lead" | "oportunidad" | "actividad" | null;

export default function QuickAddMenu({ openTrigger, dialogTrigger }: QuickAddMenuProps = {}) {
  const navigate = useNavigate();
  const { canEditCrm } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quick, setQuick] = useState<Quick>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const firstOpenRender = useRef(true);
  useEffect(() => {
    if (firstOpenRender.current) { firstOpenRender.current = false; return; }
    if (openTrigger === undefined) return;
    setMenuOpen(true);
  }, [openTrigger]);

  const firstDialogRender = useRef(true);
  useEffect(() => {
    if (firstDialogRender.current) { firstDialogRender.current = false; return; }
    if (!dialogTrigger) return;
    setQuick(dialogTrigger.kind);
  }, [dialogTrigger]);

  // REG B-004: abrir el Popover en el mismo tick del click del item pierde la
  // carrera contra el cierre del DropdownMenu (Radix desmonta el content y
  // devuelve el foco al trigger dentro del mismo gesto; el Popover recién
  // abierto se desancla). Se cierra el menú primero y se abre el popover en
  // el siguiente frame — el mismo camino de los hotkeys L/O/A, que sí
  // funcionan porque el menú ya está cerrado.
  const abrirQuick = (kind: Exclude<Quick, null>) => {
    setMenuOpen(false);
    requestAnimationFrame(() => setQuick(kind));
  };

  return (
    <>
      {/* B-004 (v13.320.32): el <PopoverAnchor asChild> envolvía a <DropdownMenu>
          — un componente sin nodo DOM propio — así que Radix nunca posicionaba
          el Popover y los items del menú se veían "muertos". Ahora envolvemos
          en un <span> real que Radix puede usar como ancla. */}
      <Popover open={quick !== null} onOpenChange={(o) => { if (!o) setQuick(null); }}>
        <PopoverAnchor asChild>
          <span className="inline-block">
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" /> Nuevo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => abrirQuick("lead")}>
                  <Users className="h-4 w-4 mr-2" /> Nuevo lead <span className="ml-auto text-2xs text-muted-foreground">L</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => abrirQuick("oportunidad")}>
                  <Target className="h-4 w-4 mr-2" /> Nueva oportunidad <span className="ml-auto text-2xs text-muted-foreground">O</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => abrirQuick("actividad")}>
                  <Activity className="h-4 w-4 mr-2" /> Nueva actividad <span className="ml-auto text-2xs text-muted-foreground">A</span>
                </DropdownMenuItem>
                {canEditCrm && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => { setMenuOpen(false); requestAnimationFrame(() => setImportOpen(true)); }}>
                      <Upload className="h-4 w-4 mr-2" /> Importar leads CSV
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </PopoverAnchor>
        <PopoverContent align="end" className="p-3">
          {quick === "lead" && (
            <QuickCreateLeadPopover
              onCreated={(id) => navigate(`/crm/leads/${id}`)}
              onMore={() => { setQuick(null); setLeadOpen(true); }}
              onClose={() => setQuick(null)}
            />
          )}
          {quick === "oportunidad" && (
            <QuickCreateOportunidadPopover
              onCreated={(id) => navigate(`/crm/oportunidades/${id}`)}
              onMore={() => { setQuick(null); setOpOpen(true); }}
              onClose={() => setQuick(null)}
            />
          )}
          {quick === "actividad" && (
            <QuickCreateActividadPopover
              onCreated={() => navigate("/crm/actividades")}
              onMore={() => { setQuick(null); setActOpen(true); }}
              onClose={() => setQuick(null)}
            />
          )}
        </PopoverContent>
      </Popover>

      <NuevoLeadDialog open={leadOpen} onOpenChange={setLeadOpen} onCreated={(id) => navigate(`/crm/leads/${id}`)} />
      <NuevaOportunidadDialog open={opOpen} onOpenChange={setOpOpen} onSaved={(id) => navigate(`/crm/oportunidades/${id}`)} />
      <NuevaActividadDialog open={actOpen} onOpenChange={setActOpen} onCreated={() => navigate("/crm/actividades")} />
      <ImportarLeadsCsvDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
