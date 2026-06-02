import { useState } from "react";
import { Loader2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  useLiquidaciones, useGenerarLiquidacion, useRegistrarPagoLiquidacion,
} from "@/hooks/comisiones";
import type { LiquidacionRow } from "@/services/comisiones/liquidaciones";

interface VendedoraOpt { id: string; nombre: string }

export function TabLiquidaciones({ vendedoras }: { vendedoras: VendedoraOpt[] }) {
  const { data: liquidaciones = [], isLoading } = useLiquidaciones();
  const [genOpen, setGenOpen] = useState(false);
  const [pagoOpen, setPagoOpen] = useState<LiquidacionRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setGenOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Generar liquidación
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Cargando…</div>
          ) : liquidaciones.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Sin liquidaciones registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2">Periodo</th>
                  <th className="p-2">Vendedora</th>
                  <th className="p-2 text-right">Total MXN</th>
                  <th className="p-2">Fecha pago</th>
                  <th className="p-2">Referencia</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((l, i) => {
                  const v = vendedoras.find((x) => x.id === l.vendedora_id);
                  return (
                    <tr key={l.id} className={i % 2 ? "bg-muted/20" : ""}>
                      <td className="p-2 font-mono text-xs">{l.periodo}</td>
                      <td className="p-2">{v?.nombre ?? l.vendedora_id}</td>
                      <td className="p-2 text-right tabular-nums font-semibold">{formatCurrency(Number(l.total_mxn), "MXN")}</td>
                      <td className="p-2">{l.fecha_pago ? formatDate(l.fecha_pago) : <span className="text-muted-foreground italic">pendiente</span>}</td>
                      <td className="p-2 text-xs text-muted-foreground">{l.referencia ?? "—"}</td>
                      <td className="p-2 text-right">
                        {!l.fecha_pago && (
                          <Button size="sm" variant="outline" onClick={() => setPagoOpen(l)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Registrar pago
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <DialogGenerar open={genOpen} onOpenChange={setGenOpen} vendedoras={vendedoras} />
      <DialogPago open={!!pagoOpen} onOpenChange={(o) => !o && setPagoOpen(null)} liq={pagoOpen} />
    </div>
  );
}

function DialogGenerar({
  open, onOpenChange, vendedoras,
}: { open: boolean; onOpenChange: (o: boolean) => void; vendedoras: VendedoraOpt[] }) {
  const { organizationId } = useOrganization();
  const [vendedoraId, setVendedoraId] = useState("");
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const gen = useGenerarLiquidacion();

  const submit = () => {
    if (!vendedoraId || !periodo || !organizationId) return;
    gen.mutate(
      { vendedora_id: vendedoraId, periodo, organization_id: organizationId },
      {
        onSuccess: () => {
          toast.success("Liquidación generada");
          onOpenChange(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Generar liquidación de comisiones</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Vendedora</Label>
            <Select value={vendedoraId} onValueChange={setVendedoraId}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {vendedoras.map((v) => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Periodo (YYYY-MM)</Label>
            <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!vendedoraId || gen.isPending}>
            {gen.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogPago({
  open, onOpenChange, liq,
}: { open: boolean; onOpenChange: (o: boolean) => void; liq: LiquidacionRow | null }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState("Transferencia");
  const [referencia, setReferencia] = useState("");
  const reg = useRegistrarPagoLiquidacion();

  if (!liq) return null;

  const submit = () => {
    reg.mutate(
      { id: liq.id, fecha_pago: fecha, metodo_pago: metodo, referencia },
      {
        onSuccess: () => { toast.success("Pago registrado"); onOpenChange(false); },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago de liquidación · {liq.periodo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Total a pagar: <strong className="text-foreground">{formatCurrency(Number(liq.total_mxn), "MXN")}</strong>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Método</Label>
              <Select value={metodo} onValueChange={setMetodo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Referencia</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="No. operación o cheque" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={reg.isPending}>
            {reg.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
