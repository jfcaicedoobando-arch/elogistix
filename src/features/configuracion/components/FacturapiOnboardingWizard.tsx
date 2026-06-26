/**
 * FacturapiOnboardingWizard — Asistente de 3 pasos para vincular la cuenta de
 * FacturApi de la org actual:
 *   1. Ambiente
 *   2. API keys (sandbox/live)
 *   3. Probar y confirmar
 *
 * Reusa hooks/servicios ya implementados (no toca backend).
 */
import { useEffect, useMemo, useState } from "react";
import { Receipt, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { notifySuccess } from "@/components/shared/utils/appFeedback";
import {
  useFacturapiCredenciales,
  useUpsertFacturapiCredenciales,
  useProbarFacturapiConexion,
} from "@/features/configuracion/hooks/useFacturapiCredenciales";
import type {
  FacturapiAmbiente,
  ProbarConexionResult,
} from "@/features/configuracion/services/facturapiCredenciales";
import { PasoAmbiente } from "./wizard/PasoAmbiente";
import { PasoApiKeys } from "./wizard/PasoApiKeys";
import { PasoProbar } from "./wizard/PasoProbar";

const PASOS = ["Ambiente", "API keys", "Probar"] as const;

interface Props {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FacturapiOnboardingWizard({ orgId, open, onOpenChange }: Props) {
  const { data } = useFacturapiCredenciales(orgId);
  const upsert = useUpsertFacturapiCredenciales(orgId);
  const probar = useProbarFacturapiConexion(orgId);

  const [paso, setPaso] = useState(1);
  const [ambiente, setAmbiente] = useState<FacturapiAmbiente>("sandbox");
  const [resultado, setResultado] = useState<ProbarConexionResult | null>(null);

  // Hidratar ambiente desde la fila al abrir.
  useEffect(() => {
    if (!open) return;
    setPaso(1);
    setAmbiente((data?.ambiente as FacturapiAmbiente) ?? "sandbox");
    setResultado(null);
  }, [open, data?.ambiente]);

  const sandboxLast4 = data?.api_key_sandbox_last4 ?? null;
  const liveLast4 = data?.api_key_live_last4 ?? null;
  const keyActivaCargada = ambiente === "sandbox" ? !!sandboxLast4 : !!liveLast4;

  const onCambiarAmbiente = (a: FacturapiAmbiente) => {
    setAmbiente(a);
    setResultado(null); // invalida prueba previa
  };

  const onProbar = async () => {
    try {
      const res = await probar.mutateAsync(ambiente);
      setResultado(res);
    } catch (err) {
      setResultado({
        ok: false,
        status: 0,
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  };

  const onFinalizar = async () => {
    await upsert.mutateAsync({
      ambiente,
      facturapi_org_id:
        resultado?.facturapi_org_id ?? data?.facturapi_org_id ?? null,
      datos_fiscales_completos: data?.datos_fiscales_completos ?? false,
      certificado_cargado: data?.certificado_cargado ?? false,
      certificado_vence_at: data?.certificado_vence_at ?? null,
    });
    notifySuccess(undefined, {
      title: `FacturApi conectado en ${ambiente === "live" ? "Producción" : "Sandbox"}`,
    });
    onOpenChange(false);
  };

  const puedeAvanzar = useMemo(() => {
    if (paso === 1) return true;
    if (paso === 2) return keyActivaCargada;
    if (paso === 3) return !!resultado?.ok;
    return false;
  }, [paso, keyActivaCargada, resultado]);

  const footer = (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setPaso((p) => Math.max(1, p - 1))}
        disabled={paso === 1}
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
      </Button>
      {paso < 3 ? (
        <Button type="button" onClick={() => setPaso((p) => p + 1)} disabled={!puedeAvanzar}>
          Siguiente <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ) : (
        <Button type="button" onClick={onFinalizar} disabled={!puedeAvanzar || upsert.isPending}>
          <CheckCircle2 className="h-4 w-4 mr-1" />
          {upsert.isPending ? "Guardando…" : "Finalizar"}
        </Button>
      )}
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Receipt}
      title="Conectar FacturApi"
      description="Vincula tu cuenta de FacturApi en 3 pasos para empezar a timbrar CFDI 4.0."
      size="lg"
      step={paso}
      totalSteps={PASOS.length}
      stepLabels={[...PASOS]}
      footer={footer}
    >
      {paso === 1 && (
        <FormDialogSection flat title="Paso 1 · Ambiente">
          <PasoAmbiente ambiente={ambiente} onChange={onCambiarAmbiente} />
        </FormDialogSection>
      )}
      {paso === 2 && (
        <FormDialogSection flat title="Paso 2 · API keys">
          <PasoApiKeys
            orgId={orgId}
            ambiente={ambiente}
            sandboxLast4={sandboxLast4}
            liveLast4={liveLast4}
          />
        </FormDialogSection>
      )}
      {paso === 3 && (
        <FormDialogSection flat title="Paso 3 · Probar conexión">
          <PasoProbar
            ambiente={ambiente}
            resultado={resultado}
            probando={probar.isPending}
            onProbar={onProbar}
          />
        </FormDialogSection>
      )}
    </FormDialogShell>
  );
}
