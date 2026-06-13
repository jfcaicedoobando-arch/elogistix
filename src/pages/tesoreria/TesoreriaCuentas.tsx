import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCuentasBancarias, useCrearCuenta, useEliminarCuenta } from "@/features/tesoreria/hooks";
import { formatCurrency } from "@/lib/formatters";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

export default function TesoreriaCuentas() {
  const { data: cuentas = [], isLoading } = useCuentasBancarias(false);
  const crear = useCrearCuenta();
  const eliminar = useEliminarCuenta();
  const [open, setOpen] = useState(false);
  const [banco, setBanco] = useState("BBVA");
  const [alias, setAlias] = useState("");
  const [numero, setNumero] = useState("");
  const [clabe, setClabe] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [saldoInicial, setSaldoInicial] = useState(0);

  const reset = () => {
    setBanco("BBVA"); setAlias(""); setNumero(""); setClabe(""); setMoneda("MXN"); setSaldoInicial(0);
  };

  const submit = async () => {
    if (!alias.trim()) return toast.error("Captura un alias");
    try {
      await crear.mutateAsync({
        banco, alias: alias.trim(), numero_cuenta: numero, clabe,
        moneda, saldo_inicial: Number(saldoInicial) || 0, activa: true,
      });
      toast.success("Cuenta creada");
      reset(); setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cuentas bancarias"
        description="Alta y administración de cuentas para conciliación"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nueva cuenta
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : cuentas.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Aún no hay cuentas. Crea la primera.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cuentas.map((c) => (
            <Card key={c.id} className={!c.activa ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{c.alias}</p>
                    <p className="text-xs text-muted-foreground">{c.banco} · {c.moneda}</p>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar cuenta "${c.alias}"?`)) eliminar.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {c.numero_cuenta && <p className="text-xs">Cuenta: <span className="font-mono">{c.numero_cuenta}</span></p>}
                {c.clabe && <p className="text-xs">CLABE: <span className="font-mono">{c.clabe}</span></p>}
                <p className="text-sm pt-2">Saldo inicial: <span className="tabular-nums font-medium">{formatCurrency(Number(c.saldo_inicial), c.moneda)}</span></p>
                {!c.activa && <p className="text-xs text-muted-foreground italic">Cuenta inactiva</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva cuenta bancaria</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Banco</Label>
              <Input value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
            <div>
              <Label>Alias *</Label>
              <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="BBVA Cheques MXN" />
            </div>
            <div>
              <Label>Número de cuenta</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <Label>CLABE</Label>
              <Input value={clabe} onChange={(e) => setClabe(e.target.value)} />
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as Moneda)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Saldo inicial</Label>
              <Input type="number" step="0.01" value={saldoInicial} onChange={(e) => setSaldoInicial(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={crear.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
