/**
 * CrearConceptoInlineForm — CTA "Crear concepto" del empty-state de
 * `ProductoServicioSelect` (Q-10, Ola 4). Alta rápida en `catalogo_claves_sat`
 * sin salir del wizard de cotización.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearProductoCatalogo, type ProductoCatalogo } from "@/features/cotizacion/services/productosCatalogoService";
import { notifyError } from "@/lib/ui/appFeedback";
import { useIvaFronteraHabilitada } from "@/features/configuracion";
import { AVISO_IVA_FRONTERA_DESHABILITADO, tipoIvaSeleccionable } from "@/lib/financial/ivaFrontera";
import { SelectTratamientoIvaFila } from "./SelectTratamientoIvaFila";

interface Props {
  organizationId: string;
  nombreInicial: string;
  onCreado: (producto: ProductoCatalogo) => void;
  onCancel: () => void;
}

export function CrearConceptoInlineForm({ organizationId, nombreInicial, onCreado, onCancel }: Props) {
  const fronteraHabilitada = useIvaFronteraHabilitada();
  const [nombre, setNombre] = useState(nombreInicial);
  const [claveSat, setClaveSat] = useState("");
  const [claveUnidad, setClaveUnidad] = useState("E48");
  const [tipoIva, setTipoIva] = useState<ProductoCatalogo["tipo_iva"]>("gravado_16");
  const [saving, setSaving] = useState(false);

  // Revalidar también al guardar: la configuración puede cambiar con el alta abierta.
  const tratamientoPermitido = tipoIvaSeleccionable(tipoIva, fronteraHabilitada);
  const puede = tratamientoPermitido && nombre.trim().length > 0 && claveSat.trim().length > 0 && claveUnidad.trim().length > 0;

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
      <p className="text-body-sm font-medium">Nuevo producto/servicio</p>
      <div className="space-y-1">
        <Label htmlFor="cci-nombre" className="text-label">Nombre</Label>
        <Input id="cci-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-8 text-body" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="cci-sat" className="text-label">Clave SAT</Label>
          <Input id="cci-sat" value={claveSat} onChange={(e) => setClaveSat(e.target.value)} placeholder="78101800" className="h-8 text-body" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cci-unidad" className="text-label">Clave unidad</Label>
          <Input id="cci-unidad" value={claveUnidad} onChange={(e) => setClaveUnidad(e.target.value)} className="h-8 text-body" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-label">IVA</Label>
        <SelectTratamientoIvaFila tipoIva={tipoIva} onTipoIvaChange={setTipoIva} />
        {!tratamientoPermitido && (
          <p role="status" className="text-label text-warning">{AVISO_IVA_FRONTERA_DESHABILITADO}</p>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="button" size="sm" disabled={!puede} onClick={handleCrear} loading={saving}>
          Crear concepto
        </Button>
      </div>
    </div>
  );
}
