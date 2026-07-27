import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/formatters";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  useVendedorasConfig, useUpsertVendedoraConfig, useUpdateVendedoraConfig,
  useEmbarquesSinVendedora, useAsignarVendedoraEmbarque,
} from "@/features/comisiones/hooks";

interface VendedoraOpt { id: string; nombre: string }

export function TabVendedorasConfig({ vendedoras }: { vendedoras: VendedoraOpt[] }) {
  return (
    <div className="space-y-4">
      <SeccionConfig vendedoras={vendedoras} />
      <SeccionEmbarquesSinAsignar vendedoras={vendedoras} />
    </div>
  );
}

function SeccionConfig({ vendedoras }: { vendedoras: VendedoraOpt[] }) {
  const { data: configs = [] } = useVendedorasConfig();
  const { organizationId } = useOrganization();
  const upsert = useUpsertVendedoraConfig();
  const update = useUpdateVendedoraConfig();

  const [nuevaVendedora, setNuevaVendedora] = useState("");
  const [nuevoPct, setNuevoPct] = useState("5");
  const [pcts, setPcts] = useState<Record<string, string>>({});

  // 13.85.10 — Toasts viven en los hooks (`useUpsertVendedoraConfig`, `useUpdateVendedoraConfig`).
  // Aquí sólo se conserva el reset de inputs en onSuccess.
  const agregar = () => {
    if (!nuevaVendedora || !organizationId) return;
    upsert.mutate({
      organization_id: organizationId,
      user_id: nuevaVendedora,
      porcentaje_default: Number(nuevoPct) || 0,
      activa: true,
    }, {
      onSuccess: () => {
        setNuevaVendedora(""); setNuevoPct("5");
      },
    });
  };

  const guardarPct = (id: string) => {
    const v = Number(pcts[id]);
    if (Number.isNaN(v) || v < 0 || v > 100) return notifyError(undefined, { title: "% inválido", method: "FEATURES_COMISIONES_COMPONENTS_TABVENDEDORASCONFIG_2" });
    update.mutate({ id, changes: { porcentaje_default: v } });
  };

  const toggleActiva = (id: string, activa: boolean) => {
    update.mutate({ id, changes: { activa } });
  };


  const disponibles = vendedoras.filter((v) => !configs.some((c) => c.user_id === v.id));

  return (
    <Card>
      <CardHeader><CardTitle>Porcentaje por vendedora</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label>Agregar vendedora</Label>
            <Select value={nuevaVendedora} onValueChange={setNuevaVendedora}>
              <SelectTrigger><SelectValue placeholder="Selecciona usuario" /></SelectTrigger>
              <SelectContent>
                {disponibles.map((v) => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-24">
            <Label>%</Label>
            <Input type="number" step="0.1" value={nuevoPct} onChange={(e) => setNuevoPct(e.target.value)} />
          </div>
          <Button onClick={agregar} disabled={!nuevaVendedora || upsert.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>

        {configs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin vendedoras configuradas.</p>
        ) : (
          <div className="space-y-2">
            {configs.map((c) => {
              const v = vendedoras.find((x) => x.id === c.user_id);
              const pct = pcts[c.id] ?? String(c.porcentaje_default);
              return (
                <div key={c.id} className="flex items-center gap-3 border rounded p-2">
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${v?.nombre ? "" : "text-muted-foreground italic"}`}>
                      {v?.nombre ?? "No disponible"}
                    </p>
                    <p className="text-xs text-muted-foreground">Alta: {formatDate(c.fecha_alta.slice(0, 10))}</p>
                  </div>
                  <Input
                    type="number" step="0.1" min="0" max="100"
                    value={pct}
                    onChange={(e) => setPcts((p) => ({ ...p, [c.id]: e.target.value }))}
                    className="w-24"
                  />
                  <Button size="sm" variant="outline" onClick={() => guardarPct(c.id)}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Switch checked={c.activa} onCheckedChange={(v) => toggleActiva(c.id, v)} />
                    <span className="text-xs text-muted-foreground">Activa</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SeccionEmbarquesSinAsignar({ vendedoras }: { vendedoras: VendedoraOpt[] }) {
  const { data: embarques = [] } = useEmbarquesSinVendedora();
  const asignar = useAsignarVendedoraEmbarque();
  const [sel, setSel] = useState<Record<string, string>>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Embarques sin vendedora asignada ({embarques.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {embarques.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos los embarques tienen vendedora asignada.</p>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {embarques.map((e) => (
              <div key={e.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                <div className="flex-1">
                  <p className="font-mono text-xs">{e.expediente}</p>
                  <p className="text-xs text-muted-foreground">{e.cliente_nombre}</p>
                </div>
                <Select value={sel[e.id] ?? ""} onValueChange={(v) => setSel((s) => ({ ...s, [e.id]: v }))}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Vendedora" /></SelectTrigger>
                  <SelectContent>
                    {vendedoras.map((v) => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  size="sm" variant="outline"
                  disabled={!sel[e.id] || asignar.isPending}
                  onClick={() => asignar.mutate({ embarqueId: e.id, vendedoraId: sel[e.id] })}
                >

                  Asignar
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
