import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { uploadFile } from '@/lib/storage';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { resolverContacto } from '@/lib/helpers';
import type { ConceptoVentaLocal, ConceptoCostoLocal } from '@/data/conceptoTypes';

export interface EmbarqueFormState {
  modo: string;
  tipo: string;
  clienteId: string;
  shipper: string;
  shipperManual: string;
  consignatario: string;
  consignatarioManual: string;
  incoterm: string;
  descripcionMercancia: string;
  pesoKg: string;
  volumenM3: string;
  piezas: string;
  tipoCarga: string;
  msdsArchivo: string | null;
  subiendoMsds: boolean;
  puertoOrigen: string;
  puertoDestino: string;
  naviera: string;
  tipoServicio: string;
  contenedor: string;
  tipoContenedor: string;
  blMaster: string;
  blHouse: string;
  aeropuertoOrigen: string;
  aeropuertoDestino: string;
  aerolinea: string;
  mawb: string;
  hawb: string;
  ciudadOrigen: string;
  ciudadDestino: string;
  transportista: string;
  cartaPorte: string;
  etd: string;
  eta: string;
  tipoCambioUSD: string;
  tipoCambioEUR: string;
}

const INITIAL_STATE: EmbarqueFormState = {
  modo: '', tipo: '', clienteId: '', shipper: '', shipperManual: '',
  consignatario: '', consignatarioManual: '', incoterm: '', descripcionMercancia: '',
  pesoKg: '', volumenM3: '', piezas: '', tipoCarga: 'Carga General',
  msdsArchivo: null, subiendoMsds: false,
  puertoOrigen: '', puertoDestino: '', naviera: '', tipoServicio: '',
  contenedor: '', tipoContenedor: '', blMaster: '', blHouse: '',
  aeropuertoOrigen: '', aeropuertoDestino: '', aerolinea: '', mawb: '', hawb: '',
  ciudadOrigen: '', ciudadDestino: '', transportista: '', cartaPorte: '',
  etd: '', eta: '', tipoCambioUSD: '17.25', tipoCambioEUR: '18.50',
};

type Setter<K extends keyof EmbarqueFormState> = (value: EmbarqueFormState[K]) => void;

export function useEmbarqueForm() {
  const [form, setForm] = useState<EmbarqueFormState>({ ...INITIAL_STATE });
  const { data: tiposDeCambio } = useExchangeRates();

  useEffect(() => {
    if (tiposDeCambio) {
      setForm(prev => ({
        ...prev,
        tipoCambioUSD: String(tiposDeCambio.usdMxn),
        tipoCambioEUR: String(tiposDeCambio.eurMxn),
      }));
    }
  }, [tiposDeCambio]);

  const setField = <K extends keyof EmbarqueFormState>(key: K): Setter<K> =>
    (value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleMsdsUpload = async (archivo: File) => {
    setForm(prev => ({ ...prev, subiendoMsds: true }));
    try {
      const ruta = `embarques/msds/${Date.now()}_${archivo.name}`;
      await uploadFile(ruta, archivo);
      setForm(prev => ({ ...prev, msdsArchivo: ruta, subiendoMsds: false }));
    } catch {
      toast({ title: "Error al subir MSDS", variant: "destructive" });
      setForm(prev => ({ ...prev, subiendoMsds: false }));
    }
  };

  const inicializarDesdeEmbarque = (embarque: any) => {
    setForm({
      modo: embarque.modo,
      tipo: embarque.tipo,
      clienteId: embarque.cliente_id,
      shipper: embarque.shipper,
      shipperManual: '',
      consignatario: embarque.consignatario,
      consignatarioManual: '',
      incoterm: embarque.incoterm,
      descripcionMercancia: embarque.descripcion_mercancia,
      pesoKg: String(embarque.peso_kg),
      volumenM3: String(embarque.volumen_m3),
      piezas: String(embarque.piezas),
      tipoCarga: embarque.tipo_carga ?? 'Carga General',
      msdsArchivo: embarque.msds_archivo ?? null,
      subiendoMsds: false,
      puertoOrigen: embarque.puerto_origen ?? '',
      puertoDestino: embarque.puerto_destino ?? '',
      naviera: embarque.naviera ?? '',
      tipoServicio: embarque.tipo_servicio ?? '',
      contenedor: embarque.contenedor ?? '',
      tipoContenedor: embarque.tipo_contenedor ?? '',
      blMaster: embarque.bl_master ?? '',
      blHouse: embarque.bl_house ?? '',
      aeropuertoOrigen: embarque.aeropuerto_origen ?? '',
      aeropuertoDestino: embarque.aeropuerto_destino ?? '',
      aerolinea: embarque.aerolinea ?? '',
      mawb: embarque.mawb ?? '',
      hawb: embarque.hawb ?? '',
      ciudadOrigen: embarque.ciudad_origen ?? '',
      ciudadDestino: embarque.ciudad_destino ?? '',
      transportista: embarque.transportista ?? '',
      cartaPorte: embarque.carta_porte ?? '',
      etd: embarque.etd ?? '',
      eta: embarque.eta ?? '',
      tipoCambioUSD: String(embarque.tipo_cambio_usd),
      tipoCambioEUR: String(embarque.tipo_cambio_eur),
    });
  };

  const buildEmbarquePayload = (
    contactos: any[],
    clienteNombre: string,
    operador: string,
  ) => ({
    cliente_id: form.clienteId,
    cliente_nombre: clienteNombre,
    modo: form.modo as any,
    tipo: form.tipo as any,
    shipper: resolverContacto(contactos, form.shipper, form.shipperManual),
    consignatario: form.consignatario === '__cliente__' ? clienteNombre : resolverContacto(contactos, form.consignatario, form.consignatarioManual),
    incoterm: form.incoterm as any,
    descripcion_mercancia: form.descripcionMercancia,
    peso_kg: Number(form.pesoKg),
    volumen_m3: Number(form.volumenM3),
    piezas: Number(form.piezas),
    puerto_origen: form.puertoOrigen || null,
    puerto_destino: form.puertoDestino || null,
    naviera: form.naviera || null,
    bl_master: form.blMaster || null,
    bl_house: form.blHouse || null,
    tipo_servicio: (form.tipoServicio as any) || null,
    contenedor: form.contenedor || null,
    tipo_contenedor: form.tipoContenedor || null,
    aeropuerto_origen: form.aeropuertoOrigen || null,
    aeropuerto_destino: form.aeropuertoDestino || null,
    aerolinea: form.aerolinea || null,
    mawb: form.mawb || null,
    hawb: form.hawb || null,
    ciudad_origen: form.ciudadOrigen || null,
    ciudad_destino: form.ciudadDestino || null,
    transportista: form.transportista || null,
    carta_porte: form.cartaPorte || null,
    etd: form.etd || null,
    eta: form.eta || null,
    tipo_cambio_usd: Number(form.tipoCambioUSD),
    tipo_cambio_eur: Number(form.tipoCambioEUR),
    tipo_carga: form.tipoCarga,
    msds_archivo: form.msdsArchivo,
    operador,
  });

  const buildConceptosVentaPayload = (conceptosVenta: ConceptoVentaLocal[]) =>
    conceptosVenta
      .filter(v => v.concepto)
      .map(v => ({
        descripcion: v.concepto,
        cantidad: v.cantidad,
        precio_unitario: v.precioUnitario,
        moneda: v.moneda as any,
        total: v.cantidad * v.precioUnitario,
      }));

  const buildConceptosCostoPayload = (
    conceptosCosto: ConceptoCostoLocal[],
    proveedoresDb: { id: string; nombre: string }[],
  ) =>
    conceptosCosto
      .filter(c => c.concepto)
      .map(c => ({
        proveedor_id: c.proveedorId || null,
        proveedor_nombre: proveedoresDb.find(p => p.id === c.proveedorId)?.nombre || '',
        concepto: c.concepto,
        monto: c.monto,
        moneda: c.moneda as any,
      }));

  return {
    form,
    setField,
    handleMsdsUpload,
    inicializarDesdeEmbarque,
    buildEmbarquePayload,
    buildConceptosVentaPayload,
    buildConceptosCostoPayload,
  };
}
