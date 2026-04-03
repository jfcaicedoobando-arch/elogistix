import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { calcularIVA } from "@/lib/financialUtils";
import { getErrorMessage } from "@/lib/errorUtils";
import {
  useCotizacion,
  useUpdateEstadoCotizacion,
  useConvertirProspectoACliente,
  useConvertirCotizacionAEmbarques,
  useEmbarquesVinculados,
} from "@/hooks/useCotizaciones";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import type { ClienteFormData } from "@/components/cotizacion/DialogConvertirProspecto";
import { usePermissions } from "@/hooks/usePermissions";

export function useCotizacionDetalleState(id: string | undefined) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: cotizacion, isLoading } = useCotizacion(id);
  const actualizarEstado = useUpdateEstadoCotizacion();
  const convertirProspecto = useConvertirProspectoACliente();
  const convertirAEmbarques = useConvertirCotizacionAEmbarques();
  const { canEdit } = usePermissions();
  const tasaIva = useTasaIVA();

  const { data: embarquesVinculados = [] } = useEmbarquesVinculados(cotizacion?.id);

  const [showConvertir, setShowConvertir] = useState(false);
  const [showConfirmarConvertir, setShowConfirmarConvertir] = useState(false);
  const [clienteForm, setClienteForm] = useState<ClienteFormData>({
    nombre: '', contacto: '', email: '', telefono: '',
    rfc: '', direccion: '', ciudad: '', estado: '', cp: '',
  });

  // Parse conceptos de venta
  const conceptosParsed = useMemo(() => {
    if (!cotizacion) return [];
    const raw = cotizacion.conceptos_venta;
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr as ConceptoVentaCotizacion[] : [];
  }, [cotizacion]);

  const conceptosVentaUSD = useMemo(() => conceptosParsed.filter(c => c.moneda === 'USD'), [conceptosParsed]);
  const conceptosVentaMXN = useMemo(() => conceptosParsed.filter(c => c.moneda === 'MXN'), [conceptosParsed]);

  // Totales calculados
  const totalUSD = useMemo(() => conceptosVentaUSD.reduce((s, c) => s + c.total, 0), [conceptosVentaUSD]);
  const subtotalMXN = useMemo(() => conceptosVentaMXN.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0), [conceptosVentaMXN]);
  const ivaMXN = calcularIVA(subtotalMXN, tasaIva);
  const totalMXN = subtotalMXN + ivaMXN;

  const handleCambiarEstado = async (estado: string) => {
    if (!cotizacion) return;
    try {
      await actualizarEstado.mutateAsync({ id: cotizacion.id, estado });
      toast({ title: `Estado actualizado a "${estado}"` });
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const abrirDialogConvertir = () => {
    if (!cotizacion) return;
    setClienteForm({
      nombre: cotizacion.prospecto_empresa || '',
      contacto: cotizacion.prospecto_contacto || '',
      email: cotizacion.prospecto_email || '',
      telefono: cotizacion.prospecto_telefono || '',
      rfc: '', direccion: '', ciudad: '', estado: '', cp: '',
    });
    setShowConvertir(true);
  };

  const handleConvertir = async () => {
    if (!cotizacion || !clienteForm.nombre.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    try {
      const cliente = await convertirProspecto.mutateAsync({
        cotizacionId: cotizacion.id,
        clienteData: clienteForm,
      });
      toast({ title: `Cliente "${cliente.nombre}" creado exitosamente` });
      setShowConvertir(false);
    } catch (err: unknown) {
      toast({ title: "Error al convertir prospecto", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleGenerarEmbarques = async () => {
    if (!cotizacion) return;
    try {
      await convertirAEmbarques.mutateAsync(cotizacion);
      toast({ title: `Se generaron ${cotizacion.num_contenedores} embarques exitosamente` });
      setShowConfirmarConvertir(false);
    } catch (err: unknown) {
      toast({ title: "Error al generar embarques", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const nombreDestinatario = cotizacion
    ? (cotizacion.es_prospecto ? `${cotizacion.prospecto_empresa} (Prospecto)` : cotizacion.cliente_nombre)
    : '';

  return {
    cotizacion,
    isLoading,
    canEdit,
    tasaIva,
    embarquesVinculados,
    conceptosVentaUSD,
    conceptosVentaMXN,
    totalUSD,
    subtotalMXN,
    ivaMXN,
    totalMXN,
    nombreDestinatario,
    // Estado de diálogos
    showConvertir,
    setShowConvertir,
    showConfirmarConvertir,
    setShowConfirmarConvertir,
    clienteForm,
    setClienteForm,
    // Acciones
    handleCambiarEstado,
    abrirDialogConvertir,
    handleConvertir,
    handleGenerarEmbarques,
    convertirProspecto,
    convertirAEmbarques,
    navigate,
  };
}
