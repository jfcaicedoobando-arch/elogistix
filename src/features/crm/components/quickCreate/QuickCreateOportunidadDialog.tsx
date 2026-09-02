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
import { useState, useMemo } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCrearOportunidad, useEtapasPipeline } from "@/features/crm/hooks";
import { useClientesForSelect } from "@/features/cliente/hooks";
import { LeadComboboxCrm } from "@/features/crm/components/comboboxes/EntidadComboboxCrm";
import { LEAD_ESTADOS_ETAPA_PROSPECTO } from "@/features/crm/domain/leads/etapas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  onMore: () => void;
}

type OrigenTipo = "prospecto" | "cliente";

export default function QuickCreateOportunidadDialog({ open, onOpenChange, onCreated, onMore }: Props) {
  const { user } = useAuth();
  const crear = useCrearOportunidad();
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect() as { data: { id: string; nombre: string }[] | undefined };
  const [nombre, setNombre] = useState("");
  const [origenTipo, setOrigenTipo] = useState<OrigenTipo>("cliente");
  const [clienteId, setClienteId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [leadNombre, setLeadNombre] = useState("");
  // v13.823.51 — el dueño canónico del prospecto (igual que el formulario
  // completo): antes el quick create reasignaba la oportunidad a quien la
  // capturaba, robándole el prospecto a su vendedor.
  const [leadVendedorId, setLeadVendedorId] = useState<string | null>(null);
  const [leadVendedorEmail, setLeadVendedorEmail] = useState("");

  const limpiarOrigen = () => {
    setClienteId(""); setLeadId(""); setLeadNombre("");
    setLeadVendedorId(null); setLeadVendedorEmail("");
  };

  const etapaInicial = useMemo(() => etapas.find((e) => e.orden === 1) ?? etapas[0], [etapas]);
  const origenListo = origenTipo === "cliente" ? !!clienteId : !!leadId;

  /** Devuelve el mensaje de validación, o null si el formulario es válido. */
  const validar = (): string | null => {
    if (!nombre.trim()) return "Nombre requerido";
    if (!etapaInicial) return "Configura el pipeline primero";
    if (!origenListo) return "Elige un prospecto o un cliente";
    return null;
  };

  /** Dueño de la oportunidad: el vendedor del prospecto, o el usuario actual. */
  const resolverVendedor = () => {
    if (origenTipo === "prospecto") {
      return {
        vendedor_id: leadVendedorId ?? user?.id ?? null,
        vendedor_email: leadVendedorEmail || user?.email || "",
      };
    }
    return { vendedor_id: user?.id ?? null, vendedor_email: user?.email ?? "" };
  };

  const submit = async () => {
    const invalido = validar();
    if (invalido) {
      notifyError(undefined, { title: invalido, method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADDIALOG_1" });
      return;
    }
    const n = nombre.trim();
    const cliente = clientes.find((c) => c.id === clienteId);
    try {
      const r = await crear.mutateAsync({
        nombre: n,
        cliente_id: origenTipo === "cliente" ? (cliente?.id ?? null) : null,
        cliente_nombre: origenTipo === "cliente" ? (cliente?.nombre ?? "") : leadNombre,
        lead_id: origenTipo === "prospecto" ? leadId : null,
        etapa_id: etapaInicial!.id,
        moneda: "MXN",
        probabilidad: etapaInicial!.probabilidad_default ?? 10,
        ...resolverVendedor(),
      });
      notifySuccess(undefined, { title: "Oportunidad creada", duration: 2000 });
      setNombre("");
      setClienteId("");
      limpiarOrigen();
      onOpenChange(false);
      onCreated(r.id);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo crear la oportunidad", description: getErrorMessage(e),
        error: e,
        method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADDIALOG_3",
      });
    }
  };

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
      isDirty={nombre.trim().length > 0}
      footer={
        <FormDialogFooter
          formId="qc-oportunidad-form"
          onCancel={() => onOpenChange(false)}
          confirmLabel="Crear"
          loading={crear.isPending}
          disabled={!etapaInicial || !origenListo}
          extra={
            <Button type="button" variant="ghost" size="sm" onClick={onMore} className="text-body-sm">
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
          <div className="space-y-1">
            <Label htmlFor="qc-oportunidad-origen">Origen *</Label>
            <Select
              value={origenTipo}
              onValueChange={(v) => { setOrigenTipo(v as OrigenTipo); limpiarOrigen(); }}
            >
              <SelectTrigger id="qc-oportunidad-origen"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="prospecto">Prospecto calificado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {origenTipo === "cliente" ? (
            <div className="space-y-1">
              <Label htmlFor="qc-oportunidad-cliente">Cliente *</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger id="qc-oportunidad-cliente"><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.slice(0, 50).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Prospecto calificado *</Label>
              <LeadComboboxCrm
                value={leadId}
                estadoIn={LEAD_ESTADOS_ETAPA_PROSPECTO}
                placeholder="Selecciona un prospecto…"
                onChange={(id, label, meta) => {
                  setLeadId(id); setLeadNombre(label);
                  setLeadVendedorId(meta?.vendedor_id ?? null);
                  setLeadVendedorEmail(meta?.vendedor_email ?? "");
                }}
              />
            </div>
          )}
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
