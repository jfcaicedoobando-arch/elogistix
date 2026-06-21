/**
 * Wizard de factura manual (sin embarque/proforma).
 *
 * Casos de uso: anticipos, servicios extra, refacturaciones que no nacen de
 * un embarque cerrado. Cliente debe estar registrado en `clientes`.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, FilePlus2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { useCrearFacturaManual } from "@/features/facturacion/hooks/useCrearFacturaManual";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";

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
  const cliente = useMemo(() => clientes.find((c) => c.id === clienteId), [clientes, clienteId]);

  const [serie, setSerie] = useState("A");
  const [usoCfdi, setUsoCfdi] = useState("G03");
  const [formaPago, setFormaPago] = useState("03");
  const [metodoPago, setMetodoPago] = useState("PUE");
  const [moneda, setMoneda] = useState<"MXN" | "USD">("MXN");
  const [tipoCambio, setTipoCambio] = useState<number>(1);
  const [fechaEmision, setFechaEmision] = useState<string>(today());
  const [diasCredito, setDiasCredito] = useState<number>(0);
  const [notas, setNotas] = useState<string>("");

  const [conceptos, setConceptos] = useState<ConceptoManualInput[]>([
    { descripcion: "", cantidad: 1, precio_unitario: 0, clave_sat: "78101800" },
  ]);

  // Si cliente cambia, pre-llena uso CFDI default
  const onClienteChange = (id: string) => {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    if (c?.uso_cfdi_default) setUsoCfdi(c.uso_cfdi_default);
  };

  const updateConcepto = (idx: number, patch: Partial<ConceptoManualInput>) => {
    setConceptos((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const addConcepto = () => {
    setConceptos((prev) => [
      ...prev,
      { descripcion: "", cantidad: 1, precio_unitario: 0, clave_sat: "78101800" },
    ]);
  };
  const removeConcepto = (idx: number) => {
    setConceptos((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const subtotal = conceptos.reduce(
    (acc, c) => acc + Number(c.cantidad || 0) * Number(c.precio_unitario || 0),
    0,
  );
  const iva = Math.round(subtotal * tasaIva * 100) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;

  const clienteIncompleto = !!cliente && (!cliente.rfc || !cliente.codigo_postal || !cliente.regimen_fiscal);
  const conceptosValidos = conceptos.every(
    (c) => c.descripcion.trim().length > 0 && Number(c.cantidad) > 0 && Number(c.precio_unitario) >= 0,
  );
  const puedeGuardar = !!cliente && conceptosValidos && fechaEmision && tipoCambio > 0;
  const puedeTimbrar = puedeGuardar && !clienteIncompleto;

  const reset = () => {
    setClienteId("");
    setConceptos([{ descripcion: "", cantidad: 1, precio_unitario: 0, clave_sat: "78101800" }]);
    setNotas("");
  };

  const handleSubmit = async (timbrarAlGuardar: boolean) => {
    if (!cliente || !organizationId) return;
    crear.mutate(
      {
        input: {
          organizationId,
          clienteId: cliente.id,
          clienteNombre: cliente.nombre,
          rfcCliente: cliente.rfc ?? "",
          serie,
          usoCfdi,
          formaPago,
          metodoPago,
          diasCredito,
          fechaEmision,
          moneda,
          tipoCambio,
          notas,
          conceptos,
          tasaIva,
        },
        timbrarAlGuardar,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5" /> Nueva factura manual
          </DialogTitle>
          <DialogDescription>
            Para anticipos, servicios extra o cobros que no provienen de un embarque cerrado.
            Lo normal es facturar desde una proforma aprobada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Cliente */}
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

          {/* Datos fiscales y condiciones */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Serie</Label>
              <Input value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase().slice(0, 5))} maxLength={5} />
            </div>
            <div>
              <Label>Fecha emisión</Label>
              <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
            </div>
            <div>
              <Label>Días crédito</Label>
              <Input
                type="number" min={0} max={365} value={diasCredito}
                onChange={(e) => setDiasCredito(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as "MXN" | "USD")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Uso CFDI</Label>
              <Select value={usoCfdi} onValueChange={setUsoCfdi}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {USOS_CFDI_SAT.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pago</Label>
              <Select value={formaPago} onValueChange={setFormaPago}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO_SAT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de cambio</Label>
              <Input
                type="number" step="0.0001" min={0.0001}
                value={tipoCambio}
                onChange={(e) => setTipoCambio(Number(e.target.value) || 1)}
                disabled={moneda === "MXN"}
              />
            </div>
          </div>

          {/* Conceptos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Conceptos *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addConcepto}>
                <Plus className="h-4 w-4 mr-1" /> Agregar concepto
              </Button>
            </div>
            <div className="border rounded-md divide-y">
              {conceptos.map((c, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 p-3 items-end">
                  <div className="col-span-5">
                    <Label className="text-xs">Descripción</Label>
                    <Input
                      value={c.descripcion}
                      onChange={(e) => updateConcepto(idx, { descripcion: e.target.value })}
                      placeholder="Ej. Anticipo servicios logísticos"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Clave SAT</Label>
                    <Input
                      value={c.clave_sat ?? ""}
                      onChange={(e) => updateConcepto(idx, { clave_sat: e.target.value })}
                      placeholder="78101800"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Cant.</Label>
                    <Input
                      type="number" min={1}
                      value={c.cantidad}
                      onChange={(e) => updateConcepto(idx, { cantidad: Number(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">P. unitario</Label>
                    <Input
                      type="number" step="0.01" min={0}
                      value={c.precio_unitario}
                      onChange={(e) => updateConcepto(idx, { precio_unitario: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="col-span-1 text-right text-sm tabular-nums">
                    {formatCurrency(Number(c.cantidad || 0) * Number(c.precio_unitario || 0), moneda)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => removeConcepto(idx)}
                      disabled={conceptos.length === 1}
                      aria-label="Eliminar concepto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-2 text-sm space-y-0.5 flex-col items-end">
              <div>Subtotal: <span className="tabular-nums font-medium">{formatCurrency(subtotal, moneda)}</span></div>
              <div>IVA ({(tasaIva * 100).toFixed(0)}%): <span className="tabular-nums font-medium">{formatCurrency(iva, moneda)}</span></div>
              <div className="text-base">Total: <span className="tabular-nums font-bold">{formatCurrency(total, moneda)}</span></div>
            </div>
          </div>

          <div>
            <Label>Notas (opcional)</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={crear.isPending}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={!puedeGuardar || crear.isPending}
          >
            Guardar borrador
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={!puedeTimbrar || crear.isPending}
          >
            {crear.isPending ? "Procesando…" : "Crear y timbrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
