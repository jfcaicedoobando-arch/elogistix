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
    <Card className="h-full">
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

function CampoFechaConCaptura({
  actual,
  original,
  embarqueId,
  campo,
  estado,
}: {
  actual: string | null;
  original: string | null | undefined;
  embarqueId: string;
  campo: "ETD" | "ETA";
  estado: string;
}) {
  const navigate = useNavigate();
  const permiteCaptura = ESTADOS_PERMITEN_CAPTURA_ETD_ETA.has(estado);
  if (!actual && permiteCaptura) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-primary hover:text-primary"
        onClick={() => navigate(`/embarques/${embarqueId}/editar`)}
      >
        <Plus className="h-3 w-3 mr-1" /> Capturar {campo}
      </Button>
    );
  }
  return <FechaConOriginal actual={actual} original={original} />;
}

export function RutaTransporteCard({ embarque }: { embarque: EmbarqueRow }) {
  const orig = embarque as Partial<{ etd_original: string | null; eta_original: string | null }>;
  return (
    <Card className="h-full">
      <CardHeader className="pb-3"><CardTitle className="text-sm">Ruta y transporte</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {embarque.modo === 'Marítimo' && <RutaMaritimo e={embarque} />}
        {embarque.modo === 'Aéreo' && <RutaAereo e={embarque} />}
        {embarque.modo === 'Terrestre' && <RutaTerrestre e={embarque} />}
        <DetailRow
          label="ETD"
          value={
            <CampoFechaConCaptura
              actual={embarque.etd}
              original={orig.etd_original}
              embarqueId={embarque.id}
              campo="ETD"
              estado={embarque.estado}
            />
          }
        />
        <DetailRow
          label="ETA"
          value={
            <CampoFechaConCaptura
              actual={embarque.eta}
              original={orig.eta_original}
              embarqueId={embarque.id}
              campo="ETA"
              estado={embarque.estado}
            />
          }
        />
        {embarque.fecha_llegada_real && (
          <DetailRow label="Llegada Real" value={formatDate(embarque.fecha_llegada_real)} />
        )}
      </CardContent>
    </Card>
  );
}
