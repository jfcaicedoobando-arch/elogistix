/**
 * Wizard de cotización informativa (tarifario). Un solo paso por simplicidad:
 * datos generales + tarifas + notas. Crea la cotización con tipo_documento='informativa'.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useClientesForSelect } from "@/features/cliente/hooks";
import { useCreateCotizacionInformativa } from "@/features/cotizacion/hooks";
import SeccionTarifasInformativas from "./SeccionTarifasInformativas";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  nuevaTarifaInformativa,
  validateCotizacionInformativa,
  type TarifaInformativa,
} from "@/features/cotizacion/types";

export default function WizardInformativa() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();
  const createMut = useCreateCotizacionInformativa();

  const [clienteId, setClienteId] = useState("");
  const [vigenciaDesde, setVigenciaDesde] = useState("");
  const [vigenciaHasta, setVigenciaHasta] = useState("");
  const [notas, setNotas] = useState("");
  const [tarifas, setTarifas] = useState<TarifaInformativa[]>([nuevaTarifaInformativa()]);

  const guardar = async () => {
    const cliente = clientes.find((c) => c.id === clienteId);
    const input = {
      cliente_id: clienteId || null,
      cliente_nombre: cliente?.nombre ?? "",
      es_prospecto: false,
      vigencia_desde: vigenciaDesde,
      vigencia_hasta: vigenciaHasta,
      tarifas,
      notas,
      operador: user?.email ?? "",
    };
    const v = validateCotizacionInformativa(input);
    if (!v.ok) {
      notifyError(undefined, { title: "Revisa los datos", description: v.errores.join(" • "), method: "FEATURES_COTIZACION_COMPONENTS_INFORMATIVA_WIZARDINFORMATIVA_1" });
      return;
    }
    try {
      const cot = await createMut.mutateAsync(input);
      toast({ title: "Tarifario creado", description: `Folio ${cot.folio}` });
      navigate(`/cotizaciones/${cot.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      notifyError(undefined, { title: msg, error: e, method: "FEATURES_COTIZACION_COMPONENTS_INFORMATIVA_WIZARDINFORMATIVA_2" });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader><CardTitle>Datos generales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vigencia desde *</Label>
            <DatePickerMx value={vigenciaDesde} onChange={setVigenciaDesde} className="w-full" />
          </div>
          <div>
            <Label>Vigencia hasta *</Label>
            <DatePickerMx value={vigenciaHasta} onChange={setVigenciaHasta} className="w-full" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tarifas vigentes</CardTitle></CardHeader>
        <CardContent>
          <SeccionTarifasInformativas tarifas={tarifas} onChange={setTarifas} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notas y condiciones</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Condiciones generales, vigencia de tipo de cambio, exclusiones, etc."
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/cotizaciones")}>Cancelar</Button>
        <Button onClick={guardar} disabled={createMut.isPending}>
          {createMut.isPending ? "Guardando..." : "Guardar tarifario"}
        </Button>
      </div>
    </div>
  );
}
