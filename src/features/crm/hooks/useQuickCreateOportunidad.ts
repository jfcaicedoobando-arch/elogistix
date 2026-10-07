/**
 * Estado y lógica de alta express de oportunidad.
 * El usuario elige empresa, etapa inicial (sólo abiertas) y valor estimado;
 * el origen (cliente o prospecto calificado) se deduce de la empresa, así el
 * guard `_crm_oportunidad_requiere_origen` sigue intacto.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { notifyError } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCrearOportunidad, useEtapasPipeline } from "@/features/crm/hooks";
import { primeraEtapaAbierta, type OrigenInicial } from "@/features/crm/domain/oportunidadFormHelpers";
import type { RefRow } from "@/features/crm/services/objetosCrm";
import { fetchOrigenEmpresa } from "@/features/crm/services/origenEmpresaCrm";

/** Lo capturado en el alta express que viaja a "Más campos →". */
export interface OportunidadQuickDraft {
  nombre: string;
  origen: OrigenInicial | null;
  empresa?: RefRow | null;
  etapaId?: string | null;
}

interface Params {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function useQuickCreateOportunidad({ open, onOpenChange, onCreated }: Params) {
  const { user } = useAuth();
  const crear = useCrearOportunidad();
  const enviandoRef = useRef(false);
  const { data: etapas = [] } = useEtapasPipeline();
  const etapasAbiertas = useMemo(() => etapas.filter((e) => e.tipo === "abierta"), [etapas]);
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState<RefRow | null>(null);
  const [etapaId, setEtapaId] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");

  const abiertoAntes = useRef(open);
  useEffect(() => {
    if (abiertoAntes.current && !open) {
      setNombre(""); setEmpresa(null); setEtapaId(""); setValorEstimado("");
    }
    abiertoAntes.current = open;
  }, [open]);

  const etapa = etapasAbiertas.find((e) => e.id === etapaId) ?? (etapaId ? undefined : primeraEtapaAbierta(etapas));
  const valor = Number(valorEstimado);
  const valorListo = valorEstimado.trim() !== "" && Number.isFinite(valor) && valor > 0;

  const origenQ = useQuery({
    queryKey: ["crm", "origen-empresa", empresa?.id ?? ""],
    queryFn: () => fetchOrigenEmpresa(empresa!.id),
    enabled: !!empresa,
  });
  const origen = origenQ.data?.ok ? origenQ.data.origen : null;
  const motivoOrigen = origenQ.data && !origenQ.data.ok ? origenQ.data.motivo : null;

  const faltantes: string[] = [];
  if (!nombre.trim()) faltantes.push("nombre");
  if (!empresa) faltantes.push("empresa asociada");
  if (!etapa) faltantes.push("etapa");
  if (!valorListo) faltantes.push("valor estimado");
  const listo = faltantes.length === 0 && !!origen;

  const construirBorrador = (): OportunidadQuickDraft => ({
    nombre: nombre.trim(), empresa, origen, etapaId: etapa?.id ?? null,
  });

  const resolverVendedor = (o: OrigenInicial) =>
    o.tipo === "prospecto" && o.vendedorId
      ? { vendedor_id: o.vendedorId, vendedor_email: o.vendedorEmail ?? "" }
      : { vendedor_id: user?.id ?? null, vendedor_email: user?.email ?? "" };

  const submit = async () => {
    if (crear.isPending || enviandoRef.current) return;
    if (!listo || !empresa || !etapa || !origen) {
      notifyError(undefined, {
        title: motivoOrigen ?? `Falta: ${faltantes.join(", ")}`,
        method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEOPORTUNIDADDIALOG_1",
      });
      return;
    }
    enviandoRef.current = true;
    try {
      const r = await crear.mutateAsync({
        nombre: nombre.trim(),
        empresa_id: empresa.id,
        cliente_id: origen.tipo === "cliente" ? origen.id : null,
        cliente_nombre: origen.nombre,
        lead_id: origen.tipo === "prospecto" ? origen.id : null,
        etapa_id: etapa.id,
        moneda: "MXN",
        probabilidad: etapa.probabilidad_default ?? 10,
        monto_meta: valor,
        ...resolverVendedor(origen),
      });
      onOpenChange(false);
      onCreated(r.id);
    } catch {
      // useCrearOportunidad ya notifica en onError; no duplicar el aviso.
    } finally {
      enviandoRef.current = false;
    }
  };

  return {
    nombre, setNombre, empresa, setEmpresa,
    etapasAbiertas, etapa, setEtapaId,
    valorEstimado, setValorEstimado,
    origenCargando: origenQ.isFetching, motivoOrigen, faltantes, listo,
    crear, submit, construirBorrador,
  };
}
