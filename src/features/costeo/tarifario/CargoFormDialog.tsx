/** Alta/edición de un cargo FOB de agente o cargo local de naviera. */
import { useState } from "react";
import { Receipt } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { costeo } from "../queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { listarEntidadesCargo, guardarCargo, type CargoTarifario, type TipoCargo } from "./cargosService";

interface Props {
  tipo: TipoCargo;
  orgId: string;
  cargo: CargoTarifario | null;
  onClose: () => void;
  onSaved: () => void;
}


export function CargoFormDialog({ tipo, orgId, cargo, onClose, onSaved }: Props) {
  const { data: entidades = [] } = useQuery({ queryKey: costeo.tarifario.entidades(tipo), queryFn: () => listarEntidadesCargo(tipo) });
  const [entidad, setEntidad] = useState(cargo?.entidad_id ?? "");
  const [concepto, setConcepto] = useState(cargo?.concepto ?? (tipo === "fob" ? "Cargos FOB" : "Revalidación"));
  const [monto, setMonto] = useState(cargo ? String(cargo.monto) : "");
  const [moneda, setMoneda] = useState(cargo?.moneda ?? (tipo === "fob" ? "USD" : "MXN"));
  const [unidad, setUnidad] = useState(cargo?.unidad ?? "");
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    const n = Number(monto);
    if (!entidad || !concepto.trim() || !Number.isFinite(n) || n < 0) {
      notifyError(undefined, { title: "Revisa el cargo", description: "Completa el " + (tipo === "fob" ? "agente" : "naviera") + ", concepto y un monto válido.", method: "CargoFormDialog.validar" });
      return;
    }
    setBusy(true);
    try {
      await guardarCargo(tipo, orgId, { entidad_id: entidad, concepto: concepto.trim(), monto: n, moneda, unidad: unidad.trim() || null }, cargo?.id);
      notifySuccess(undefined, { title: "Cargo guardado" });
      onSaved();
      onClose();
    } catch (error) {
      notifyError(undefined, { title: "No se pudo guardar el cargo. Revisa que tengas permiso de Pricing.", error, method: "guardarCargo" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialogShell open onOpenChange={(o) => { if (!o) onClose(); }} icon={Receipt} busy={busy}
      title={cargo ? "Editar cargo" : "Nuevo cargo"}
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => void guardar()} disabled={busy}>Guardar</Button></>}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label>{tipo === "fob" ? "Agente" : "Naviera"}</Label>
          <Select value={entidad || undefined} onValueChange={setEntidad}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>{entidades.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="cargo-concepto">Concepto</Label><Input id="cargo-concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="cargo-monto">Monto</Label><Input id="cargo-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <Select value={moneda} onValueChange={setMoneda}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["USD", "MXN", "EUR"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="cargo-unidad">Unidad</Label><Input id="cargo-unidad" placeholder="Por contenedor, por BL…" value={unidad} onChange={(e) => setUnidad(e.target.value)} /></div>
      </div>
    </FormDialogShell>
  );
}
