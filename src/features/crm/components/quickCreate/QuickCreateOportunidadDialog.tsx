/**
 * QuickCreateOportunidadDialog — alta express de oportunidad (nombre + origen).
 *
 * v13.746.0: migrado de Popover a modal estándar (ver nota en
 * `QuickCreateLeadDialog.tsx`): el Popover anidado en el menú "Nuevo" no
 * alcanzaba a abrirse y el clic parecía muerto.
 *
 * v13.823.50: el diálogo iniciaba en "Sin cliente" y permitía enviar
 * `cliente_id = null` + `lead_id = null`, combinación que el trigger
 * `_crm_oportunidad_requiere_origen` rechaza (`LC_OPORTUNIDAD_SIN_ORIGEN`).
 * Ahora hay que elegir un origen válido: prospecto calificado o cliente.
 *
 * v13.823.51: la lista de prospectos usa la definición canónica del embudo
 * (`LEAD_ESTADOS_ETAPA_PROSPECTO`), que excluye `Convertido` — un lead ya
 * convertido en cliente salió del embudo y no es origen válido.
 */
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { MSG_SIN_ETAPA_ABIERTA } from "@/features/crm/domain/oportunidadFormHelpers";
import { useQuickCreateOportunidad, type OportunidadQuickDraft } from "./useQuickCreateOportunidad";
import QuickCreateOportunidadOrigenFields from "./QuickCreateOportunidadOrigenFields";

export type { OportunidadQuickDraft };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  onMore: (draft: OportunidadQuickDraft) => void;
}

export default function QuickCreateOportunidadDialog({ open, onOpenChange, onCreated, onMore }: Props) {
  const {
    nombre, setNombre,
    origenTipo, setOrigenTipo,
    clienteId, setClienteId,
    leadId, setLeadNombre,
    setLeadVendedorId, setLeadVendedorEmail,
    limpiarOrigen,
    etapaInicial, origenListo,
    clientes,
    crear,
    submit,
    construirBorrador,
  } = useQuickCreateOportunidad({ open, onOpenChange, onCreated });

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Target}
      title="Nueva oportunidad"
      description="Se crea en la primera etapa del embudo; después puedes completar montos y ruta."
      size="md"
      formId="qc-oportunidad-form"
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      isDirty={
        nombre.trim().length > 0 ||
        clienteId.length > 0 ||
        leadId.length > 0 ||
        origenTipo !== "cliente"
      }
      busy={crear.isPending}
      footer={
        <FormDialogFooter
          formId="qc-oportunidad-form"
          onCancel={() => onOpenChange(false)}
          confirmLabel="Crear"
          loading={crear.isPending}
          disabled={!etapaInicial || !origenListo}
          extra={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMore(construirBorrador())}
              disabled={crear.isPending}
              className="text-body-sm"
            >
              Más campos →
            </Button>
          }
        />
      }
    >
      <FormDialogSection flat>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="qc-oportunidad-nombre">Nombre *</Label>
            <Input
              id="qc-oportunidad-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Importación China Q1"
            />
          </div>
          {!etapaInicial && (
            <p role="alert" className="text-body-sm text-destructive">{MSG_SIN_ETAPA_ABIERTA}</p>
          )}
          <QuickCreateOportunidadOrigenFields
            origenTipo={origenTipo}
            onOrigenTipoChange={(t) => { setOrigenTipo(t); limpiarOrigen(); }}
            clienteId={clienteId}
            onClienteIdChange={setClienteId}
            clientes={clientes}
            leadId={leadId}
            onLead={(id, label, meta) => {
              setClienteId((prev) => prev); // no-op: mantiene tipo de firma estable
              setLeadNombre(label);
              setLeadVendedorId(meta?.vendedor_id ?? null);
              setLeadVendedorEmail(meta?.vendedor_email ?? "");
              // El id del lead se fija tras las asignaciones anteriores.
              // (ver nota abajo)
            }}
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
