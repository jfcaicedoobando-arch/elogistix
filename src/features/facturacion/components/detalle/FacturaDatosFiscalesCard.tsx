/**
 * FacturaDatosFiscalesCard — formulario para editar los datos fiscales
 * del borrador (Serie, Uso CFDI, Forma/Método de pago, días crédito, notas,
 * tipo de cambio). Muestra checks fiscales del cliente en línea para saber
 * si falta RFC/CP/Régimen antes de intentar timbrar.
 */
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors/index";
import { queryKeys } from "@/lib/query";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";
import {
  fetchClienteFiscal,
  actualizarDatosTimbradoFactura,
  type DatosTimbradoPatch,
  type ClienteFiscalRow,
} from "@/features/facturacion/services";
import { buildChecksTimbrado } from "@/features/facturacion/utils/validarDatosTimbrado";
import type { FacturaDetalle } from "@/features/facturacion/hooks";

interface Props {
  factura: FacturaDetalle;
}

export function FacturaDatosFiscalesCard({ factura }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: cliente } = useQuery<ClienteFiscalRow | null>({
    queryKey: ["cliente_fiscal", factura.cliente_id],
    enabled: !!factura.cliente_id,
    queryFn: () => fetchClienteFiscal(factura.cliente_id!),
  });

  const [serie, setSerie] = useState(factura.serie ?? "A");
  const [usoCfdi, setUsoCfdi] = useState(factura.uso_cfdi ?? "G03");
  const [formaPago, setFormaPago] = useState(factura.forma_pago ?? "03");
  const [metodoPago, setMetodoPago] = useState(factura.metodo_pago ?? "PUE");
  const [diasCredito, setDiasCredito] = useState<number>(factura.dias_credito ?? 0);
  const [tipoCambio, setTipoCambio] = useState<number>(Number(factura.tipo_cambio ?? 1));
  const [notas, setNotas] = useState(factura.notas ?? "");

  // Sincroniza con el default del cliente al cargar.
  useEffect(() => {
    if (cliente?.uso_cfdi_default && !factura.uso_cfdi) {
      setUsoCfdi(cliente.uso_cfdi_default);
    }
  }, [cliente?.uso_cfdi_default, factura.uso_cfdi]);

  const { checks, puedeTimbrar } = buildChecksTimbrado({
    rfc: cliente?.rfc ?? factura.rfc_cliente ?? "",
    cp: cliente?.codigo_postal ?? "",
    regimen: cliente?.regimen_fiscal ?? "",
    usoCfdi,
    formaPago,
    metodoPago,
  });

  const guardar = useMutation({
    mutationFn: (patch: DatosTimbradoPatch) => actualizarDatosTimbradoFactura(factura.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(factura.id) });
      toast({ title: "Datos fiscales actualizados" });
    },
    onError: (err) =>
      toast({ title: "No se pudo guardar", description: getErrorMessage(err), variant: "destructive" }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    guardar.mutate({
      serie: serie.toUpperCase().slice(0, 5),
      uso_cfdi: usoCfdi,
      forma_pago: formaPago,
      metodo_pago: metodoPago,
      dias_credito: Math.max(0, Math.round(diasCredito)),
      notas: notas.trim() ? notas.trim() : null,
      tipo_cambio: factura.moneda === "MXN" ? 1 : Math.max(0, Number(tipoCambio) || 1),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Datos fiscales del borrador</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <ul className="text-xs space-y-0.5">
            {checks.map((c, i) => (
              <li key={i} className={c.ok ? "text-success" : "text-destructive"}>
                {c.ok ? "✓" : "✗"} {c.label}
              </li>
            ))}
          </ul>
          {!puedeTimbrar && (
            <p className="text-xs text-muted-foreground">
              Completa los datos del cliente en su ficha para poder timbrar.
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>Serie</Label>
              <Input value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase().slice(0, 5))} maxLength={5} />
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
              <Label>Método de pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO_SAT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
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
              <Label>Días de crédito</Label>
              <Input type="number" min={0} value={diasCredito}
                     onChange={(e) => setDiasCredito(Number(e.target.value) || 0)} />
            </div>
            {factura.moneda !== "MXN" && (
              <div>
                <Label>Tipo de cambio</Label>
                <Input type="number" step="0.0001" min={0} value={tipoCambio}
                       onChange={(e) => setTipoCambio(Number(e.target.value) || 1)} />
              </div>
            )}
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
                      placeholder="Notas internas para el CFDI (opcional)" />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={guardar.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {guardar.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
