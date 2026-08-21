/**
 * Fila de captura de una API key de FacturApi (sandbox o producción).
 * Extraído de FacturapiCredencialesForm para cumplir Power of 10 (≤200 líneas).
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Trash2, Save, PlugZap } from "lucide-react";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import type { FacturapiAmbiente } from "@/features/configuracion/services/facturapiCredenciales";
import {
  useSetFacturapiApiKey,
  useClearFacturapiApiKey,
  useProbarFacturapiConexion,
} from "@/features/configuracion/hooks/useFacturapiCredenciales";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

interface ApiKeyRowProps {
  orgId: string;
  ambiente: FacturapiAmbiente;
  last4: string | null;
  label: string;
  prefijo: string;
}

export function FacturapiApiKeyRow({ orgId, ambiente, last4, label, prefijo }: ApiKeyRowProps) {
  const [valor, setValor] = useState("");
  // UX-07: quitar una API key es destructivo (rompe el timbrado) → confirmación.
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const setKey = useSetFacturapiApiKey(orgId);
  const clearKey = useClearFacturapiApiKey(orgId);
  const probar = useProbarFacturapiConexion(orgId);
  const cargada = !!last4;

  const onGuardar = async () => {
    const v = valor.trim();
    if (!v.startsWith(prefijo)) {
      notifyError(undefined, { title: `La key de ${label} debe comenzar con ${prefijo}`, method: "ApiKeyRow.onGuardar" });
      return;
    }
    try {
      await setKey.mutateAsync({ ambiente, apiKey: v });
      setValor("");
      notifySuccess(undefined, { title: `API key (${label}) guardada` });
    } catch { /* notifyError ya viene del hook */ }
  };

  const onProbar = async () => {
    try {
      const res = await probar.mutateAsync(ambiente);
      if (res.ok) {
        notifySuccess(undefined, { title: `Conexión OK${res.nombre ? ` — ${res.nombre}` : ""}` });
      } else {
        notifyError(undefined, { title: "FacturApi rechazó la API key", method: "ApiKeyRow.onProbar", error: res });
      }
    } catch { /* ya notificó */ }
  };

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm flex items-center gap-2">
          API key — {label}
          {cargada ? (
            <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Cargada · {prefijo}••••{last4}</Badge>
          ) : (
            <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3" /> Vacía</Badge>
          )}
        </Label>
        {cargada && (
          <Button
            type="button" size="sm" variant="ghost"
            onClick={() => setConfirmarQuitar(true)}
            disabled={clearKey.isPending}
            aria-label={`Quitar la API key de ${label}`}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Quitar
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          id={`facturapi-apikey-${ambiente}`}
          aria-label={`API key — ${label}`}
          type="password"
          autoComplete="off"
          placeholder={cargada ? "Pega una nueva key para reemplazar" : `${prefijo}…`}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="font-mono text-xs"
        />
        <Button type="button" onClick={onGuardar} disabled={!valor.trim() || setKey.isPending} loading={setKey.isPending}>
          {!setKey.isPending && <Save className="h-4 w-4 mr-1" />}
          Guardar
        </Button>
        <Button type="button" variant="outline" onClick={onProbar} disabled={!cargada || probar.isPending} loading={probar.isPending}>
          {!probar.isPending && <PlugZap className="h-4 w-4 mr-1" />}
          Probar
        </Button>
      </div>
      <p className="text-label text-muted-foreground">
        La key se guarda cifrada en el servidor. Aquí sólo ves los últimos 4 dígitos.
      </p>
      <ConfirmActionDialog
        open={confirmarQuitar}
        onOpenChange={setConfirmarQuitar}
        title={`¿Quitar la API key de ${label}?`}
        description="Mientras no cargues una key nueva no podrás timbrar facturas en este ambiente. Esta acción no se puede deshacer."
        confirmLabel="Quitar la key"
        variant="destructive"
        isPending={clearKey.isPending}
        onConfirm={() => {
          clearKey.mutate(ambiente);
          setConfirmarQuitar(false);
        }}
      />
    </div>
  );
}
