/**
 * QuickCreateOportunidadPopover — alta express de oportunidad (nombre + cliente opcional).
 */
import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCrearOportunidad, useEtapasPipeline } from "@/features/crm/hooks";
import { useClientesForSelect } from "@/features/cliente/hooks";

import { notifyError } from "@/lib/ui/appFeedback";
import { SectionHeading } from "@/components/shared/SectionHeading";
interface Props {
  onCreated: (id: string) => void;
  onMore: () => void;
  onClose: () => void;
}

export default function QuickCreateOportunidadPopover({ onCreated, onMore, onClose }: Props) {
  const { user } = useAuth();
  const crear = useCrearOportunidad();
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect() as { data: { id: string; nombre: string }[] | undefined };
  const [nombre, setNombre] = useState("");
  const [clienteId, setClienteId] = useState<string>("ninguno");

  const etapaInicial = useMemo(() => etapas.find((e) => e.orden === 1) ?? etapas[0], [etapas]);

  const submit = async () => {
    const n = nombre.trim();
    if (!n) return notifyError(undefined, { title: "Nombre requerido", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADPOPOVER_1" });
    if (!etapaInicial) return notifyError(undefined, { title: "Configura el pipeline primero", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADPOPOVER_2" });
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
      setNombre(""); setClienteId("ninguno");
      onClose();
      onCreated(r.id);
    } catch (e) {
      notifyError(undefined, { title: e instanceof Error ? e.message : "Error al crear", error: e, method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADPOPOVER_3" });
    }
  };

  return (
    <div className="space-y-3 w-80">
      <SectionHeading as="h3">Nueva oportunidad</SectionHeading>
      <div className="space-y-1">
        <Label className="text-xs">Nombre *</Label>
        <Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Importación China Q1" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Cliente</Label>
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger><SelectValue placeholder="Sin cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguno">Sin cliente</SelectItem>
            {clientes.slice(0, 50).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onMore} className="text-xs">Más campos →</Button>
        <Button size="sm" onClick={submit} disabled={crear.isPending || !etapaInicial}>
          {crear.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Crear
        </Button>
      </div>
    </div>
  );
}
