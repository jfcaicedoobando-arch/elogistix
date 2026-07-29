/**
 * CrearConceptoInlineForm — CTA "Crear concepto" del empty-state de
 * `ProductoServicioSelect` (Q-10, Ola 4). Alta rápida en `catalogo_claves_sat`
 * sin salir del wizard de cotización.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearProductoCatalogo, type ProductoCatalogo } from "@/features/cotizacion/services/productosCatalogoService";
import { notifyError } from "@/lib/ui/appFeedback";

interface Props {
  organizationId: string;
  nombreInicial: string;
  onCreado: (producto: ProductoCatalogo) => void;
  onCancel: () => void;
}

export function CrearConceptoInlineForm({ organizationId, nombreInicial, onCreado, onCancel }: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [claveSat, setClaveSat] = useState("");
  const [claveUnidad, setClaveUnidad] = useState("E48");
  const [tipoIva, setTipoIva] = useState<ProductoCatalogo["tipo_iva"]>("gravado_16");
  const [saving, setSaving] = useState(false);

  const puede = nombre.trim().length > 0 && claveSat.trim().length > 0 && claveUnidad.trim().length > 0;

  const handleCrear = async () => {
    if (!puede || saving) return;
    setSaving(true);
    try {
      const producto = await crearProductoCatalogo(organizationId, {
        nombre: nombre.trim(),
        clave_sat: claveSat.trim(),
        clave_unidad_sat: claveUnidad.trim(),
        tipo_iva: tipoIva,
      });
      onCreado(producto);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo crear el concepto",
        error: e,
        method: "CREAR_CONCEPTO_INLINE_FORM",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-2" data-testid="crear-concepto-inline-form">
      <p className="text-xs font-medium">Nuevo producto/servicio</p>
      <div className="space-y-1">
        <Label htmlFor="cci-nombre" className="text-2xs">Nombre</Label>
        <Input id="cci-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="cci-sat" className="text-2xs">Clave SAT</Label>
          <Input id="cci-sat" value={claveSat} onChange={(e) => setClaveSat(e.target.value)} placeholder="78101800" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cci-unidad" className="text-2xs">Clave unidad</Label>
          <Input id="cci-unidad" value={claveUnidad} onChange={(e) => setClaveUnidad(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-2xs">IVA</Label>
        <Select value={tipoIva} onValueChange={(v) => setTipoIva(v as ProductoCatalogo["tipo_iva"])}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gravado_16">Gravado 16%</SelectItem>
            <SelectItem value="tasa_0">Tasa 0%</SelectItem>
            <SelectItem value="exento">Exento</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="button" size="sm" disabled={!puede || saving} onClick={handleCrear}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          Crear concepto
        </Button>
      </div>
    </div>
  );
}
