import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, toTitleCase, nombreDesdeEmail, formatNumber } from "@/lib/formatters";
import { DetailRow } from "../DetailRow";
import { FechaConOriginal } from "./FechaConOriginal";
import type { EmbarqueRow } from "@/features/embarques/hooks";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { useTiposContenedor } from "@/features/catalogos/hooks/useTiposContenedor";
import { resolveTipoContenedorNombre } from "@/features/cotizacion/utils/resolveTipoContenedorNombre";

const PLACEHOLDER = "—";

function ResumenContenedores({ embarqueId, fallbackTipo }: { embarqueId: string; fallbackTipo: string }) {
  const { data: contenedores = [] } = useContenedoresEmbarque(embarqueId);
  if (contenedores.length === 0) return <span>{PLACEHOLDER}</span>;
  if (contenedores.length === 1) {
    const c = contenedores[0];
    const tipo = c.tipo_contenedor || fallbackTipo || PLACEHOLDER;
    return <span>{c.numero_contenedor || PLACEHOLDER} ({tipo})</span>;
  }
  // Agrupar por tipo cuando hay varios
  const conteos = new Map<string, number>();
  for (const c of contenedores) {
    const tipo = c.tipo_contenedor || fallbackTipo || PLACEHOLDER;
    conteos.set(tipo, (conteos.get(tipo) ?? 0) + 1);
  }
  const resumen = Array.from(conteos.entries())
    .map(([tipo, n]) => `${n} × ${tipo}`)
    .join(" · ");
  return <span>{resumen}</span>;
}

function RutaMaritimo({ e }: { e: EmbarqueRow }) {
  const { data: tipos = [] } = useTiposContenedor();
  const tipoNombre = resolveTipoContenedorNombre(e.tipo_contenedor, tipos, PLACEHOLDER);
  return (
    <>
      <DetailRow label="Puerto Origen" value={e.puerto_origen || PLACEHOLDER} />
      <DetailRow label="Puerto Destino" value={e.puerto_destino || PLACEHOLDER} />
      <DetailRow label="Naviera" value={e.naviera || PLACEHOLDER} />
      <DetailRow label="BL Master" value={e.bl_master || PLACEHOLDER} />
      <DetailRow label="BL House" value={e.bl_house || PLACEHOLDER} />
      <DetailRow label="Servicio" value={e.tipo_servicio || PLACEHOLDER} />
      <DetailRow
        label="Contenedores"
        value={<ResumenContenedores embarqueId={e.id} fallbackTipo={tipoNombre} />}
      />
    </>
  );
}

function RutaAereo({ e }: { e: EmbarqueRow }) {
  return (
    <>
      <DetailRow label="Aeropuerto Origen" value={e.aeropuerto_origen || PLACEHOLDER} />
      <DetailRow label="Aeropuerto Destino" value={e.aeropuerto_destino || PLACEHOLDER} />
      <DetailRow label="Aerolínea" value={e.aerolinea || PLACEHOLDER} />
      <DetailRow label="MAWB" value={e.mawb || PLACEHOLDER} />
      <DetailRow label="HAWB" value={e.hawb || PLACEHOLDER} />
    </>
  );
}

function RutaTerrestre({ e }: { e: EmbarqueRow }) {
  return (
    <>
      <DetailRow label="Ciudad Origen" value={e.ciudad_origen || PLACEHOLDER} />
      <DetailRow label="Ciudad Destino" value={e.ciudad_destino || PLACEHOLDER} />
      <DetailRow label="Transportista" value={e.transportista || PLACEHOLDER} />
      <DetailRow label="Carta Porte" value={e.carta_porte || PLACEHOLDER} />
    </>
  );
}

export function DatosGeneralesCard({ embarque }: { embarque: EmbarqueRow }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Datos generales</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <DetailRow label="Tipo" value={embarque.tipo} />
        <DetailRow
          label="Incoterm"
          value={
            <span className="inline-flex items-center gap-2">
              {embarque.incoterm}
              {(embarque.incoterm === "CIF" || embarque.incoterm === "CIP") && (
                <span
                  className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary"
                  title="Flete y seguro pagados por el shipper en origen"
                >
                  Flete + seguro en origen
                </span>
              )}
              {(embarque.incoterm === "CFR" ||
                embarque.incoterm === "CPT" ||
                embarque.incoterm === "DAP" ||
                embarque.incoterm === "DDP" ||
                embarque.incoterm === "DAT") && (
                <span
                  className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary"
                  title="Flete pagado por el shipper en origen"
                >
                  Flete en origen
                </span>
              )}
            </span>
          }
        />
        <DetailRow label="Mercancía" value={toTitleCase(embarque.descripcion_mercancia) || PLACEHOLDER} />
        <DetailRow label="Peso" value={formatNumber(Number(embarque.peso_kg), { suffix: "kg" })} />
        <DetailRow label="Volumen" value={formatNumber(Number(embarque.volumen_m3), { decimals: 2, suffix: "m³" })} />
        <DetailRow label="Piezas" value={formatNumber(embarque.piezas)} />
        <DetailRow label="Responsable operativo" value={nombreDesdeEmail(embarque.operador) || PLACEHOLDER} />
      </CardContent>
    </Card>
  );
}

const ESTADOS_PERMITEN_CAPTURA_ETD_ETA = new Set(["Confirmado", "En Tránsito"]);

function BotonCapturarFecha({
  campo,
  embarqueId,
}: {
  campo: "ETD" | "ETA";
  embarqueId: string;
}) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto p-0 text-xs font-normal text-primary hover:no-underline"
      onClick={() => navigate(`/embarques/${embarqueId}/editar`)}
    >
      <Plus className="h-3 w-3 mr-1" /> Capturar {campo}
    </Button>
  );
}

function BannerCaptureFechas({ embarqueId }: { embarqueId: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        ETD y ETA sin capturar
      </span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs font-medium text-primary hover:no-underline"
        onClick={() => navigate(`/embarques/${embarqueId}/editar`)}
      >
        Capturar fechas
      </Button>
    </div>
  );
}

export function RutaTransporteCard({ embarque }: { embarque: EmbarqueRow }) {
  const orig = embarque as Partial<{ etd_original: string | null; eta_original: string | null }>;
  const permiteCaptura = ESTADOS_PERMITEN_CAPTURA_ETD_ETA.has(embarque.estado);
  const faltaETD = !embarque.etd;
  const faltaETA = !embarque.eta;
  const faltanAmbas = permiteCaptura && faltaETD && faltaETA;

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Ruta y transporte</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {embarque.modo === 'Marítimo' && <RutaMaritimo e={embarque} />}
        {embarque.modo === 'Aéreo' && <RutaAereo e={embarque} />}
        {embarque.modo === 'Terrestre' && <RutaTerrestre e={embarque} />}

        {faltanAmbas ? (
          <BannerCaptureFechas embarqueId={embarque.id} />
        ) : (
          <>
            <DetailRow
              label="ETD"
              value={
                faltaETD && permiteCaptura
                  ? <BotonCapturarFecha campo="ETD" embarqueId={embarque.id} />
                  : <FechaConOriginal actual={embarque.etd} original={orig.etd_original} />
              }
            />
            <DetailRow
              label="ETA"
              value={
                faltaETA && permiteCaptura
                  ? <BotonCapturarFecha campo="ETA" embarqueId={embarque.id} />
                  : <FechaConOriginal actual={embarque.eta} original={orig.eta_original} />
              }
            />
          </>
        )}

        {embarque.fecha_llegada_real && (
          <DetailRow label="Llegada Real" value={formatDate(embarque.fecha_llegada_real)} />
        )}
      </CardContent>
    </Card>
  );
}
