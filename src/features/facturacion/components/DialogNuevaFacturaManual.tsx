/**
 * Wizard de factura manual (sin embarque/proforma).
 * Casos: anticipos, servicios extra, refacturaciones sin embarque cerrado.
 * Migrado a `FormDialogShell` (v13.120.0).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { useCrearFacturaManual } from "@/features/facturacion/hooks/useCrearFacturaManual";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import { FacturaManualDatosFiscales, type DatosFiscalesValue } from "./FacturaManualDatosFiscales";
import { FacturaManualConceptosTable } from "./FacturaManualConceptosTable";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface ClienteOpt {
  id: string;
  nombre: string;
  rfc: string | null;
  codigo_postal: string | null;
  regimen_fiscal: string | null;
  uso_cfdi_default: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

const INITIAL_FISCAL: DatosFiscalesValue = {
  serie: "A", fechaEmision: today(), diasCredito: 0, moneda: "MXN",
  usoCfdi: "G03", formaPago: "03", metodoPago: "PUE", tipoCambio: 1,
};

const INITIAL_CONCEPTOS: ConceptoManualInput[] = [
  { descripcion: "", cantidad: 1, precio_unitario: 0, clave_sat: "78101800", tipo_iva: "gravado_16" },
];

export function DialogNuevaFacturaManual({ open, onOpenChange }: Props) {
  const { organizationId } = useAuth();
  const tasaIva = useTasaIVA();
  const crear = useCrearFacturaManual();

  const { data: clientes = [] } = useQuery<ClienteOpt[]>({
    queryKey: ["clientes_fiscal_opts", organizationId],
    enabled: open && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre, rfc, codigo_postal, regimen_fiscal, uso_cfdi_default")
        .order("nombre")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as ClienteOpt[];
    },
  });

  const [clienteId, setClienteId] = useState<string>("");
  const [fiscal, setFiscal] = useState<DatosFiscalesValue>(INITIAL_FISCAL);
  const [conceptos, setConceptos] = useState<ConceptoManualInput[]>(INITIAL_CONCEPTOS);
  const [notas, setNotas] = useState<string>("");

  const cliente = useMemo(() => clientes.find((c) => c.id === clienteId), [clientes, clienteId]);

  const onClienteChange = (id: string) => {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    if (c?.uso_cfdi_default) setFiscal((prev) => ({ ...prev, usoCfdi: c.uso_cfdi_default! }));
  };

  const updateFiscal = (patch: Partial<DatosFiscalesValue>) => setFiscal((prev) => ({ ...prev, ...patch }));

  const clienteIncompleto = !!cliente && (!cliente.rfc || !cliente.codigo_postal || !cliente.regimen_fiscal);
  const conceptosValidos = conceptos.every(
    (c) => c.descripcion.trim().length > 0 && Number(c.cantidad) > 0 && Number(c.precio_unitario) >= 0,
  );
  const puedeGuardar = !!cliente && conceptosValidos && fiscal.fechaEmision && fiscal.tipoCambio > 0;
  const puedeTimbrar = puedeGuardar && !clienteIncompleto;

  const reset = () => {
    setClienteId("");
    setFiscal(INITIAL_FISCAL);
    setConceptos(INITIAL_CONCEPTOS);
    setNotas("");
  };

  const handleSubmit = (timbrarAlGuardar: boolean) => {
    if (!cliente || !organizationId) return;
    crear.mutate(
      {
        input: {
          organizationId, clienteId: cliente.id, clienteNombre: cliente.nombre,
          rfcCliente: cliente.rfc ?? "",
          serie: fiscal.serie, usoCfdi: fiscal.usoCfdi,
          formaPago: fiscal.formaPago, metodoPago: fiscal.metodoPago,
          diasCredito: fiscal.diasCredito, fechaEmision: fiscal.fechaEmision,
          moneda: fiscal.moneda, tipoCambio: fiscal.tipoCambio,
          notas, conceptos, tasaIva,
        },
        timbrarAlGuardar,
      },
      { onSuccess: () => { reset(); onOpenChange(false); } },
    );
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={crear.isPending}>Cancelar</Button>
      <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={!puedeGuardar || crear.isPending}>
        Guardar borrador
      </Button>
      <Button onClick={() => handleSubmit(true)} disabled={!puedeTimbrar || crear.isPending}>
        {crear.isPending ? "Procesando…" : "Crear y timbrar"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FilePlus2}
      title="Nueva factura manual"
      description="Para anticipos, servicios extra o cobros que no provienen de un embarque cerrado. Lo normal es facturar desde una proforma aprobada."
      size="xl"
      footer={footer}
    >
      <div>
        <Label>Cliente *</Label>
        <Select value={clienteId} onValueChange={onClienteChange}>
          <SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre} {c.rfc ? `· ${c.rfc}` : "· sin RFC"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clienteIncompleto && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>
              Este cliente no tiene datos fiscales completos (RFC, CP y régimen).
              Puedes guardar borrador, pero no podrás timbrar hasta completarlos en el detalle del cliente.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <FacturaManualDatosFiscales value={fiscal} onChange={updateFiscal} />

      <FacturaManualConceptosTable
        conceptos={conceptos}
        moneda={fiscal.moneda}
        tasaIva={tasaIva}
        onChange={setConceptos}
      />

      <div>
        <Label>Notas (opcional)</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
      </div>
    </FormDialogShell>
  );
}
