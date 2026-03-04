import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useCotizacionCostos, useUpsertCotizacionCostos,
  type CostoCotizacion,
} from "@/hooks/useCotizacionCostos";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, DollarSign, Package } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface FilaCosto {
  _key: string;
  id?: string;
  concepto: string;
  proveedor: string;
  moneda: string;
  cantidad: number;
  costo_unitario: number;
}

function crearFilaVacia(): FilaCosto {
  return {
    _key: crypto.randomUUID(),
    concepto: "",
    proveedor: "",
    moneda: "USD",
    cantidad: 1,
    costo_unitario: 0,
  };
}

interface Props {
  cotizacionId: string;
}

export default function SeccionCostosInternosCotizacion({ cotizacionId }: Props) {
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const { data: costosGuardados, isLoading } = useCotizacionCostos(cotizacionId);
  const upsert = useUpsertCotizacionCostos();

  const [filas, setFilas] = useState<FilaCosto[]>([]);
  const [inicializado, setInicializado] = useState(false);

  useEffect(() => {
    if (isLoading || inicializado) return;
    if (costosGuardados && costosGuardados.length > 0) {
      setFilas(
        costosGuardados.map((c) => ({
          _key: c.id,
          id: c.id,
          concepto: c.concepto,
          proveedor: c.proveedor ?? "",
          moneda: c.moneda,
          cantidad: c.cantidad,
          costo_unitario: c.costo_unitario,
        }))
      );
    }
    setInicializado(true);
  }, [isLoading, costosGuardados, inicializado]);

  const actualizarFila = (key: string, campo: keyof FilaCosto, valor: string | number) => {
    setFilas((prev) =>
      prev.map((f) => (f._key === key ? { ...f, [campo]: valor } : f))
    );
  };

  const agregarFila = () => setFilas((prev) => [...prev, crearFilaVacia()]);

  const eliminarFila = (fila: FilaCosto) => {
    setFilas((prev) => prev.filter((f) => f._key !== fila._key));
  };

  const guardar = async () => {
    const costosToSave: CostoCotizacion[] = filas.map((f) => ({
      id: f.id ?? f._key,
      cotizacion_id: cotizacionId,
      concepto: f.concepto,
      proveedor: f.proveedor || '',
      moneda: f.moneda as 'USD' | 'MXN',
      cantidad: f.cantidad,
      costo_unitario: f.costo_unitario,
      costo_total: f.cantidad * f.costo_unitario,
      created_at: '',
      updated_at: '',
    }));
    try {
      const result = await upsert.mutateAsync({ cotizacionId, costos: costosToSave });
      if (result && result.length > 0) {
        setFilas(result.map((r) => ({
          _key: r.id,
          id: r.id,
          concepto: r.concepto,
          proveedor: r.proveedor,
          moneda: r.moneda,
          cantidad: r.cantidad,
          costo_unitario: r.costo_unitario,
        })));
      }
      toast({ title: "Costos guardados correctamente" });
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    }
  };

  const totales = useMemo(() => {
    let totalUSD = 0;
    let totalMXN = 0;
    for (const f of filas) {
      const t = f.cantidad * f.costo_unitario;
      if (f.moneda === 'USD') totalUSD += t;
      else totalMXN += t;
    }
    return { totalUSD, totalMXN };
  }, [filas]);

  if (!canEdit) return null;
  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Costos Internos
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona los costos de proveedores para esta cotización
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={agregarFila}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
          <Button size="sm" onClick={guardar} disabled={upsert.isPending}>
            <Save className="h-4 w-4 mr-1" /> {upsert.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen */}
        {filas.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <KPICard label="Total USD" value={formatCurrency(totales.totalUSD, "USD")} icon={<DollarSign className="h-4 w-4" />} />
            <KPICard label="Total MXN" value={formatCurrency(totales.totalMXN, "MXN")} icon={<DollarSign className="h-4 w-4" />} />
          </div>
        )}

        {/* Filas */}
        <div className="space-y-3">
          {filas.map((fila, idx) => (
            <CostoRow
              key={fila._key}
              fila={fila}
              index={idx}
              onUpdate={actualizarFila}
              onDelete={() => eliminarFila(fila)}
              isDeleting={false}
            />
          ))}
          {filas.length === 0 && (
            <div className="text-center text-muted-foreground py-10 border border-dashed rounded-lg">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Sin costos registrados</p>
              <p className="text-xs mt-1">Presiona "Agregar" para crear una fila</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Sub-componentes ── */

function KPICard({ label, value, icon }: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg border-l-4 border-l-primary p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function CostoRow({ fila, index, onUpdate, onDelete, isDeleting }: {
  fila: FilaCosto;
  index: number;
  onUpdate: (key: string, campo: keyof FilaCosto, valor: string | number) => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const costoTotal = fila.cantidad * fila.costo_unitario;

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          {index + 1}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="col-span-2 md:col-span-1">
          <Label className="text-xs text-muted-foreground">Concepto</Label>
          <Input
            value={fila.concepto}
            onChange={(e) => onUpdate(fila._key, "concepto", e.target.value)}
            placeholder="Ej: Flete marítimo"
            className="h-9 mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Proveedor</Label>
          <Input
            value={fila.proveedor}
            onChange={(e) => onUpdate(fila._key, "proveedor", e.target.value)}
            placeholder="Nombre"
            className="h-9 mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Moneda</Label>
          <Select value={fila.moneda} onValueChange={(v) => onUpdate(fila._key, "moneda", v)}>
            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Cantidad</Label>
          <Input
            type="number"
            value={fila.cantidad}
            onChange={(e) => onUpdate(fila._key, "cantidad", Number(e.target.value))}
            className="h-9 mt-1 text-right tabular-nums"
            min={0}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Costo Unitario</Label>
          <Input
            type="number"
            value={fila.costo_unitario}
            onChange={(e) => onUpdate(fila._key, "costo_unitario", Number(e.target.value))}
            className="h-9 mt-1 text-right tabular-nums"
            min={0}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Costo Total</Label>
          <div className="h-9 mt-1 flex items-center justify-end px-3 rounded-md bg-muted/50 text-sm font-semibold tabular-nums">
            {formatCurrency(costoTotal, fila.moneda)}
          </div>
        </div>
      </div>
    </div>
  );
}
