import { useEffect, useCallback } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { uploadFile } from '@/lib/storage';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { resolverContacto } from '@/lib/helpers';
import { getDocsForMode } from '@/data/embarqueConstants';
import type { DocumentoChecklist } from '@/components/DocumentChecklist';
import type { ConceptoVentaLocal, ConceptoCostoLocal } from '@/data/conceptoTypes';
import { useState } from 'react';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type EmbarqueRow = Tables<'embarques'>;
type ContactoRow = Pick<Tables<'contactos_cliente'>, 'id' | 'nombre' | 'tipo' | 'pais'>;

export interface EmbarqueFormValues {
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
  agente: string;
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

/** Keep backward compat alias */
export type EmbarqueFormState = EmbarqueFormValues;

const DEFAULT_VALUES: EmbarqueFormValues = {
  modo: '', tipo: '', clienteId: '', shipper: '', shipperManual: '',
  consignatario: '', consignatarioManual: '', incoterm: 'FOB', descripcionMercancia: '',
  pesoKg: '', volumenM3: '', piezas: '', tipoCarga: 'Carga General',
  msdsArchivo: null, subiendoMsds: false,
  puertoOrigen: '', puertoDestino: '', naviera: '', agente: '', tipoServicio: '',
  contenedor: '', tipoContenedor: '', blMaster: '', blHouse: '',
  aeropuertoOrigen: '', aeropuertoDestino: '', aerolinea: '', mawb: '', hawb: '',
  ciudadOrigen: '', ciudadDestino: '', transportista: '', cartaPorte: '',
  etd: '', eta: '', tipoCambioUSD: '17.25', tipoCambioEUR: '18.50',
};

export type EmbarqueFormMethods = UseFormReturn<EmbarqueFormValues>;

export function useEmbarqueForm() {
  const methods = useForm<EmbarqueFormValues>({
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });

  const [documentosArchivos, setDocumentosArchivos] = useState<Record<string, File>>({});
  const { data: tiposDeCambio } = useExchangeRates();

  useEffect(() => {
    if (tiposDeCambio) {
      methods.setValue('tipoCambioUSD', String(tiposDeCambio.usdMxn));
      methods.setValue('tipoCambioEUR', String(tiposDeCambio.eurMxn));
    }
  }, [tiposDeCambio, methods]);

  const handleMsdsUpload = async (archivo: File) => {
    methods.setValue('subiendoMsds', true);
    try {
      const ruta = `embarques/msds/${Date.now()}_${archivo.name}`;
      await uploadFile(ruta, archivo);
      methods.setValue('msdsArchivo', ruta);
      methods.setValue('subiendoMsds', false);
    } catch {
      toast({ title: "Error al subir MSDS", variant: "destructive" });
      methods.setValue('subiendoMsds', false);
    }
  };

  const inicializarDesdeEmbarque = (embarque: EmbarqueRow) => {
    methods.reset({
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
      agente: embarque.agente ?? '',
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
    contactos: ContactoRow[],
    clienteNombre: string,
    operador: string,
  ): Omit<TablesInsert<'embarques'>, 'expediente'> => {
    const v = methods.getValues();
    return {
      cliente_id: v.clienteId || null!,
      cliente_nombre: clienteNombre,
      modo: v.modo as TablesInsert<'embarques'>['modo'],
      tipo: v.tipo as TablesInsert<'embarques'>['tipo'],
      shipper: resolverContacto(contactos, v.shipper, v.shipperManual),
      consignatario: v.consignatario === '__cliente__' ? clienteNombre : resolverContacto(contactos, v.consignatario, v.consignatarioManual),
      incoterm: v.incoterm as TablesInsert<'embarques'>['incoterm'],
      descripcion_mercancia: v.descripcionMercancia,
      peso_kg: Number(v.pesoKg),
      volumen_m3: Number(v.volumenM3),
      piezas: Number(v.piezas),
      puerto_origen: v.puertoOrigen || null,
      puerto_destino: v.puertoDestino || null,
      naviera: v.naviera || null,
      agente: v.agente || null,
      bl_master: v.blMaster || null,
      bl_house: v.blHouse || null,
      tipo_servicio: (v.tipoServicio as TablesInsert<'embarques'>['tipo_servicio']) || null,
      contenedor: v.contenedor || null,
      tipo_contenedor: v.tipoContenedor || null,
      aeropuerto_origen: v.aeropuertoOrigen || null,
      aeropuerto_destino: v.aeropuertoDestino || null,
      aerolinea: v.aerolinea || null,
      mawb: v.mawb || null,
      hawb: v.hawb || null,
      ciudad_origen: v.ciudadOrigen || null,
      ciudad_destino: v.ciudadDestino || null,
      transportista: v.transportista || null,
      carta_porte: v.cartaPorte || null,
      etd: v.etd || null,
      eta: v.eta || null,
      tipo_cambio_usd: Number(v.tipoCambioUSD),
      tipo_cambio_eur: Number(v.tipoCambioEUR),
      tipo_carga: v.tipoCarga,
      msds_archivo: v.msdsArchivo,
      operador,
    };
  };

  const buildConceptosVentaPayload = (conceptosVenta: ConceptoVentaLocal[]) =>
    conceptosVenta
      .filter(v => v.concepto)
      .map(v => ({
        descripcion: v.concepto,
        cantidad: v.cantidad,
        precio_unitario: v.precioUnitario,
        moneda: v.moneda as TablesInsert<'conceptos_venta'>['moneda'],
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
        moneda: c.moneda as TablesInsert<'conceptos_costo'>['moneda'],
      }));

  const setDocumentoArchivo = useCallback((nombre: string, file: File | undefined) => {
    setDocumentosArchivos(prev => {
      if (!file) {
        const next = { ...prev };
        delete next[nombre];
        return next;
      }
      return { ...prev, [nombre]: file };
    });
  }, []);

  const getDocumentosChecklist = useCallback((modo: string): DocumentoChecklist[] => {
    const docs = getDocsForMode(modo);
    return docs.map(nombre => ({
      nombre,
      adjuntado: !!documentosArchivos[nombre],
      archivo: documentosArchivos[nombre]?.name,
    }));
  }, [documentosArchivos]);

  return {
    methods,
    handleMsdsUpload,
    inicializarDesdeEmbarque,
    buildEmbarquePayload,
    buildConceptosVentaPayload,
    buildConceptosCostoPayload,
    documentosArchivos,
    setDocumentoArchivo,
    getDocumentosChecklist,
  };
}
