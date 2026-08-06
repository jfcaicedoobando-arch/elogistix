/**
 * FacturaReceptorCard — datos fiscales del cliente que se van a timbrar,
 * con validación inline (✓/✗) por campo. Reemplaza al banner de alerta
 * `FacturaFiscalCheckAlert` cuando aparece dentro del detalle: consolida el
 * checklist fiscal en un solo lugar. Si falta algún dato, ofrece un CTA a
 * la ficha del cliente para completarlo.
 * v13.308.16: el nombre del cliente pasa al título del card (antes era una
 * fila más) para evitar triplicar el mismo dato en la vista.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, X, UserCog, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldGridSkeleton } from "@/components/shared/skeletons";
import {
  fetchClienteFiscal,
  type ClienteFiscalRow,
} from "@/features/facturacion/services";
import { REGIMENES_FISCALES_SAT } from "@/constants/regimenFiscalSAT";
import { USOS_CFDI_SAT } from "@/constants/catalogosSAT";
import { toTitleCase } from "@/lib/formatters";
import { queryKeys } from "@/lib/query";

interface Props {
  clienteId: string;
  clienteNombre: string;
  rfcFactura: string | null;
}

const CP_REGEX = /^\d{5}$/;

function labelRegimen(clave: string | null | undefined): string {
  if (!clave) return "";
  const r = REGIMENES_FISCALES_SAT.find((x) => x.clave === clave);
  return r ? `${r.clave} — ${r.descripcion}` : clave;
}

function labelUsoCfdi(clave: string | null | undefined): string {
  if (!clave) return "";
  const u = USOS_CFDI_SAT.find((x) => x.value === clave);
  return u ? u.label : clave;
}

function Row({ label, ok, value, missingLabel }: { label: string; ok: boolean; value: string; missingLabel: string }) {
  return (
    <div className="min-w-0">
      <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-sm font-medium truncate flex items-center gap-1 ${ok ? "" : "text-destructive italic"}`}>
        {ok ? <Check className="h-3 w-3 text-success shrink-0" /> : <X className="h-3 w-3 text-destructive shrink-0" />}
        <span className="truncate">{ok ? value : missingLabel}</span>
      </p>
    </div>
  );
}

export function FacturaReceptorCard({ clienteId, clienteNombre, rfcFactura }: Props) {
  const { data: cliente, isLoading } = useQuery<ClienteFiscalRow | null>({
    queryKey: queryKeys.facturacion.clienteFiscal(clienteId),
    queryFn: () => fetchClienteFiscal(clienteId),
    staleTime: 60 * 1000,
  });

  const rfc = (cliente?.rfc ?? rfcFactura ?? "").trim();
  const cp = (cliente?.codigo_postal ?? "").trim();
  const regimen = (cliente?.regimen_fiscal ?? "").trim();
  const usoDefault = (cliente?.uso_cfdi_default ?? "").trim();

  const rfcOk = rfc.length >= 12;
  const cpOk = CP_REGEX.test(cp);
  const regimenOk = !!regimen;
  const usoOk = !!usoDefault;

  const todoOk = rfcOk && cpOk && regimenOk && usoOk;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" /> Receptor
          </CardTitle>
          <Link
            to={`/clientes/${clienteId}`}
            className="text-sm font-medium text-accent hover:underline block truncate mt-1"
          >
            {toTitleCase(clienteNombre)}
          </Link>
        </div>
        {!todoOk && (
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to={`/clientes/${clienteId}`}>
              <UserCog className="h-4 w-4 mr-1" /> Completar datos
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <FieldGridSkeleton fields={4} cols={4} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Row label="RFC" ok={rfcOk} value={rfc} missingLabel="Falta RFC" />
            <Row label="Código postal" ok={cpOk} value={cp} missingLabel="Falta CP" />
            <Row label="Régimen fiscal" ok={regimenOk} value={labelRegimen(regimen)} missingLabel="Falta régimen" />
            <Row label="Uso CFDI por defecto" ok={usoOk} value={labelUsoCfdi(usoDefault)} missingLabel="Sin default" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
