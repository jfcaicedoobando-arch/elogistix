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
import { useCallback, useEffect, useRef, useState } from "react";
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
import QuickCreateLeadDialog, {
  type LeadQuickDraft,
} from "@/features/crm/components/quickCreate/QuickCreateLeadDialog";
import QuickCreateOportunidadDialog, {
  type OportunidadQuickDraft,
} from "@/features/crm/components/quickCreate/QuickCreateOportunidadDialog";
import QuickCreateActividadDialog, {
  type ActividadQuickDraft,
} from "@/features/crm/components/quickCreate/QuickCreateActividadDialog";
import { usePermissions } from "@/hooks/shared";

export interface QuickAddMenuProps {
  openTrigger?: number;
  dialogTrigger?: { kind: "lead" | "oportunidad" | "actividad"; n: number };
}

type Quick = "lead" | "oportunidad" | "actividad" | null;

/** Sólo se transporta el borrador si el usuario alcanzó a capturar algo. */
function conDatos<T extends object>(draft: T, campos: Array<keyof T>): T | null {
  return campos.some((c) => Boolean(draft[c])) ? draft : null;
}

export default function QuickAddMenu({ openTrigger, dialogTrigger }: QuickAddMenuProps = {}) {
  const navigate = useNavigate();
  const { canCrearLead, canGestionarLeadsEnLote, canCrearOportunidad, canCrearActividad } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quick, setQuick] = useState<Quick>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Borrador mínimo del alta express de oportunidad: se conserva sólo mientras
  // el formulario completo está abierto (transición "Más campos →").
  const [opDraft, setOpDraft] = useState<OportunidadQuickDraft | null>(null);
  const [leadDraft, setLeadDraft] = useState<LeadQuickDraft | null>(null);
  const [actDraft, setActDraft] = useState<ActividadQuickDraft | null>(null);

  /**
   * Espejo de las policies RLS: oportunidades y actividades sólo se crean con
   * la capacidad específica (staff CRM o vendedor sobre sus registros).
   */
  const puedeCrear = useCallback((kind: Exclude<Quick, null>): boolean => {
    if (kind === "lead") return canCrearLead;
    if (kind === "oportunidad") return canCrearOportunidad;
    return canCrearActividad;
  }, [canCrearLead, canCrearOportunidad, canCrearActividad]);

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
    if (!puedeCrear(dialogTrigger.kind)) return;
    setQuick(dialogTrigger.kind);
  }, [dialogTrigger, puedeCrear]);

  const abrirQuick = (kind: Exclude<Quick, null>) => {
    // Los atajos L/O/A y el menú comparten exactamente el mismo candado.
    if (!puedeCrear(kind)) return;
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
          {canCrearOportunidad && (
            <DropdownMenuItem onSelect={() => abrirQuick("oportunidad")}>
              <Target className="h-4 w-4 mr-2" /> Nueva oportunidad <span className="ml-auto text-label text-muted-foreground">O</span>
            </DropdownMenuItem>
          )}
          {canCrearActividad && (
            <DropdownMenuItem onSelect={() => abrirQuick("actividad")}>
              <Activity className="h-4 w-4 mr-2" /> Nueva actividad <span className="ml-auto text-label text-muted-foreground">A</span>
            </DropdownMenuItem>
          )}
          {canGestionarLeadsEnLote && (
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
        onMore={(draft) => {
          setQuick(null);
          setLeadDraft(conDatos(draft, ["empresa", "contacto"]));
          setLeadOpen(true);
        }}
      />
      <QuickCreateOportunidadDialog
        open={quick === "oportunidad"}
        onOpenChange={cerrarQuick}
        onCreated={(id) => navigate(`/crm/oportunidades/${id}`)}
        onMore={(draft) => {
          setQuick(null);
          setOpDraft(draft.nombre || draft.origen ? draft : null);
          setOpOpen(true);
        }}
      />
      <QuickCreateActividadDialog
        open={quick === "actividad"}
        onOpenChange={cerrarQuick}
        onCreated={() => navigate("/crm/actividades")}
        onMore={(draft) => {
          setQuick(null);
          setActDraft(conDatos(draft, ["asunto", "entidadId"]));
          setActOpen(true);
        }}
      />

      <NuevoLeadDialog
        open={leadOpen}
        onOpenChange={(next) => { setLeadOpen(next); if (!next) setLeadDraft(null); }}
        draftInicial={leadDraft}
        onCreated={(id) => navigate(`/crm/leads/${id}`)}
      />
      <NuevaOportunidadDialog
        open={opOpen}
        onOpenChange={(next) => { setOpOpen(next); if (!next) setOpDraft(null); }}
        origenInicial={opDraft?.origen ?? null}
        nombreInicial={opDraft?.nombre ?? null}
        onSaved={(id) => navigate(`/crm/oportunidades/${id}`)}
      />
      <NuevaActividadDialog
        open={actOpen}
        onOpenChange={(next) => { setActOpen(next); if (!next) setActDraft(null); }}
        asuntoInicial={actDraft?.asunto ?? null}
        fechaInicial={actDraft?.fecha ?? null}
        entidadIdInicial={actDraft?.entidadId ?? null}
        onCreated={() => navigate("/crm/actividades")}
      />
      <ImportarLeadsCsvDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
