/**
 * QuickCreateOportunidadDialog — alta express de oportunidad (nombre + cliente).
 *
 * v13.746.0: migrado de Popover a modal estándar (ver nota en
 * `QuickCreateLeadDialog.tsx`): el Popover anidado en el menú "Nuevo" no
 * alcanzaba a abrirse y el clic parecía muerto.
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  onMore: () => void;
}

export default function QuickCreateOportunidadDialog({ open, onOpenChange, onCreated, onMore }: Props) {
  const { user } = useAuth();
  const crear = useCrearOportunidad();
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect() as { data: { id: string; nombre: string }[] | undefined };
  const [nombre, setNombre] = useState("");
  const [clienteId, setClienteId] = useState<string>("ninguno");

  const etapaInicial = useMemo(() => etapas.find((e) => e.orden === 1) ?? etapas[0], [etapas]);

  const submit = async () => {
    const n = nombre.trim();
    if (!n) {
      notifyError(undefined, { title: "Nombre requerido", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADDIALOG_1" });
      return;
    }
    if (!etapaInicial) {
      notifyError(undefined, { title: "Configura el pipeline primero", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADDIALOG_2" });
      return;
    }
    const cliente = clientes.find((c) => c.id === clienteId);
    try {
      const r = await crear.mutateAsync({
        nombre: n,
        cliente_id: cliente?.id ?? null,
        cliente_nombre: cliente?.nombre ?? "",
        etapa_id: etapaInicial.id,
        moneda: "MXN",
        probabilidad: etapaInicial.probabilidad_default ?? 10,
        vendedor_id: user?.id ?? null,
        vendedor_email: user?.email ?? "",
      });
      notifySuccess(undefined, { title: "Oportunidad creada", duration: 2000 });
      setNombre("");
      setClienteId("ninguno");
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
          disabled={!etapaInicial}
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
            <Label htmlFor="qc-oportunidad-cliente">Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger id="qc-oportunidad-cliente"><SelectValue placeholder="Sin cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin cliente</SelectItem>
                {clientes.slice(0, 50).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
