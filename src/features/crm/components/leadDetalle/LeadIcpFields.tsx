/**
 * Campos del Perfil ICP del lead (presentación pura).
 * Separado de `LeadIcpCard` para respetar Power of 10 (≤200 líneas).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ICP_ESTATUS, ICP_FRECUENCIAS, ICP_INCOTERMS, type LeadIcpForm,
} from "@/features/crm/domain/leads/icp";

interface Props {
  form: LeadIcpForm;
  set: <K extends keyof LeadIcpForm>(k: K, v: LeadIcpForm[K]) => void;
  canEdit: boolean;
}

export default function LeadIcpFields({ form, set, canEdit }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor="lead-icp-sector">Sector / giro</Label>
        <Input
          id="lead-icp-sector"
          placeholder="Automotriz, agroindustria…"
          value={form.sector}
          onChange={(e) => set("sector", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-sitio-web">Sitio web</Label>
        <Input
          id="lead-icp-sitio-web"
          placeholder="https://"
          value={form.sitio_web}
          onChange={(e) => set("sitio_web", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-anios-establecida">Años establecida</Label>
        <Input
          id="lead-icp-anios-establecida"
          type="number"
          min={0}
          value={form.anios_establecida}
          onChange={(e) => set("anios_establecida", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-proveedor-actual">Proveedor actual</Label>
        <Input
          id="lead-icp-proveedor-actual"
          placeholder="Forwarder o naviera que usa hoy"
          value={form.proveedor_actual}
          onChange={(e) => set("proveedor_actual", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-mercancia">Mercancía</Label>
        <Input
          id="lead-icp-mercancia"
          placeholder="Autopartes, resinas…"
          value={form.mercancia}
          onChange={(e) => set("mercancia", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-rutas">Rutas</Label>
        <Input
          id="lead-icp-rutas"
          placeholder="Shanghái → Manzanillo"
          value={form.rutas}
          onChange={(e) => set("rutas", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-aduana-puerto">Aduana / puerto</Label>
        <Input
          id="lead-icp-aduana-puerto"
          value={form.aduana_puerto}
          onChange={(e) => set("aduana_puerto", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label>Incoterm</Label>
        <Select
          value={form.incoterm || "sin_dato"}
          onValueChange={(v) => set("incoterm", v === "sin_dato" ? "" : v)}
          disabled={!canEdit}
        >
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sin_dato">Sin dato</SelectItem>
            {ICP_INCOTERMS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-volumen">Volumen</Label>
        <Input
          id="lead-icp-volumen"
          placeholder="4 contenedores 40' HC"
          value={form.volumen}
          onChange={(e) => set("volumen", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label>Frecuencia</Label>
        <Select
          value={form.frecuencia || "sin_dato"}
          onValueChange={(v) => set("frecuencia", v === "sin_dato" ? "" : v)}
          disabled={!canEdit}
        >
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sin_dato">Sin dato</SelectItem>
            {ICP_FRECUENCIAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label>Dolor explícito</Label>
        <Textarea
          rows={2}
          placeholder="Lo que el prospecto dijo con sus palabras"
          value={form.dolor_explicito}
          onChange={(e) => set("dolor_explicito", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label>Consecuencia del dolor</Label>
        <Textarea
          rows={2}
          placeholder="Qué le cuesta hoy (costo, tiempo, riesgo)"
          value={form.consecuencia}
          onChange={(e) => set("consecuencia", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label>Estatus ICP</Label>
        <Select
          value={normalizarEstatusIcp(form.estatus_icp)}
          onValueChange={(v) => set("estatus_icp", v)}
          disabled={!canEdit}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {opcionesEstatusIcp(form.estatus_icp).map((e) => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-fecha-nutricion">Fecha de nutrición</Label>
        <Input
          id="lead-icp-fecha-nutricion"
          type="date"
          value={form.fecha_nutricion}
          onChange={(e) => set("fecha_nutricion", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label htmlFor="lead-icp-motivo-nutricion">Motivo de nutrición</Label>
        <Input
          id="lead-icp-motivo-nutricion"
          placeholder="Por qué no avanza ahora"
          value={form.motivo_nutricion}
          onChange={(e) => set("motivo_nutricion", e.target.value)}
          disabled={!canEdit}
        />
      </div>
    </div>
  );
}
