import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { containerTypes } from "@/data/containerTypes";
import PortSelect from "@/components/PortSelect";
import ShippingLineSelect from "@/components/ShippingLineSelect";

interface Props {
  modo: string;
  puertoOrigen: string; setPuertoOrigen: (v: string) => void;
  puertoDestino: string; setPuertoDestino: (v: string) => void;
  naviera: string; setNaviera: (v: string) => void;
  blMaster: string; setBlMaster: (v: string) => void;
  blHouse: string; setBlHouse: (v: string) => void;
  tipoServicio: string; setTipoServicio: (v: string) => void;
  contenedor: string; setContenedor: (v: string) => void;
  tipoContenedor: string; setTipoContenedor: (v: string) => void;
  aeropuertoOrigen: string; setAeropuertoOrigen: (v: string) => void;
  aeropuertoDestino: string; setAeropuertoDestino: (v: string) => void;
  aerolinea: string; setAerolinea: (v: string) => void;
  mawb: string; setMawb: (v: string) => void;
  hawb: string; setHawb: (v: string) => void;
  ciudadOrigen: string; setCiudadOrigen: (v: string) => void;
  ciudadDestino: string; setCiudadDestino: (v: string) => void;
  transportista: string; setTransportista: (v: string) => void;
  cartaPorte: string; setCartaPorte: (v: string) => void;
  etd: string; setEtd: (v: string) => void;
  eta: string; setEta: (v: string) => void;
}

export function StepDatosRuta(props: Props) {
  const { modo } = props;

  return (
    <Card>
      <CardHeader><CardTitle>Datos de Ruta {modo && `— ${modo}`}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(modo === 'Marítimo' || !modo) && (<>
            <div className="space-y-2"><Label>Puerto Origen *</Label><PortSelect value={props.puertoOrigen} onValueChange={props.setPuertoOrigen} placeholder="Seleccionar puerto origen" /></div>
            <div className="space-y-2"><Label>Puerto Destino *</Label><PortSelect value={props.puertoDestino} onValueChange={props.setPuertoDestino} placeholder="Seleccionar puerto destino" /></div>
            <div className="space-y-2"><Label>Naviera *</Label><ShippingLineSelect value={props.naviera} onValueChange={props.setNaviera} /></div>
            <div className="space-y-2"><Label># BL Master</Label><Input placeholder="Número de BL" value={props.blMaster} onChange={e => props.setBlMaster(e.target.value)} /></div>
            <div className="space-y-2"><Label># BL House</Label><Input value={props.blHouse} onChange={e => props.setBlHouse(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Tipo de Servicio *</Label>
              <Select value={props.tipoServicio} onValueChange={(v) => { props.setTipoServicio(v); if (v === 'LCL') props.setTipoContenedor('LCL'); }}><SelectTrigger><SelectValue placeholder="FCL / LCL" /></SelectTrigger>
                <SelectContent><SelectItem value="FCL">FCL</SelectItem><SelectItem value="LCL">LCL</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label># Contenedor *</Label><Input value={props.contenedor} onChange={e => props.setContenedor(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Tipo Contenedor *</Label>
              {props.tipoServicio === 'LCL' ? (
                <Input value="LCL (Carga Consolidada)" disabled />
              ) : (
                <Select value={props.tipoContenedor} onValueChange={props.setTipoContenedor}><SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>{containerTypes.filter(ct => ct.code !== 'LCL').map(ct => <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </>)}
          {modo === 'Aéreo' && (<>
            <div className="space-y-2"><Label>Aeropuerto Origen</Label><Input placeholder="Ej: Incheon (ICN)" value={props.aeropuertoOrigen} onChange={e => props.setAeropuertoOrigen(e.target.value)} /></div>
            <div className="space-y-2"><Label>Aeropuerto Destino</Label><Input placeholder="Ej: AICM (MEX)" value={props.aeropuertoDestino} onChange={e => props.setAeropuertoDestino(e.target.value)} /></div>
            <div className="space-y-2"><Label>Aerolínea</Label><Input value={props.aerolinea} onChange={e => props.setAerolinea(e.target.value)} /></div>
            <div className="space-y-2"><Label># MAWB</Label><Input value={props.mawb} onChange={e => props.setMawb(e.target.value)} /></div>
            <div className="space-y-2"><Label># HAWB</Label><Input value={props.hawb} onChange={e => props.setHawb(e.target.value)} /></div>
          </>)}
          {modo === 'Terrestre' && (<>
            <div className="space-y-2"><Label>Ciudad Origen</Label><Input placeholder="Ej: Houston, TX" value={props.ciudadOrigen} onChange={e => props.setCiudadOrigen(e.target.value)} /></div>
            <div className="space-y-2"><Label>Ciudad Destino</Label><Input placeholder="Ej: León, Guanajuato" value={props.ciudadDestino} onChange={e => props.setCiudadDestino(e.target.value)} /></div>
            <div className="space-y-2"><Label>Transportista</Label><Input value={props.transportista} onChange={e => props.setTransportista(e.target.value)} /></div>
            <div className="space-y-2"><Label># Carta Porte</Label><Input value={props.cartaPorte} onChange={e => props.setCartaPorte(e.target.value)} /></div>
          </>)}
          <div className="space-y-2"><Label>ETD (Fecha Salida) *</Label><Input type="date" value={props.etd} onChange={e => props.setEtd(e.target.value)} /></div>
          <div className="space-y-2"><Label>ETA (Fecha Llegada Estimada) *</Label><Input type="date" value={props.eta} onChange={e => props.setEta(e.target.value)} /></div>
        </div>
      </CardContent>
    </Card>
  );
}
