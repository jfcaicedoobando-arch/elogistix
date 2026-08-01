/**
 * Estado del formulario de subida al buzón CxP: dos ranuras (PDF + XML),
 * lectura automática del CFDI y detección del proveedor por RFC.
 */
import { useCallback, useMemo, useState } from "react";
import { emparejarArchivosEntrantes, validarParejaEntrante } from "@/lib/domain/facturasEntrantes";
import { extraerCfdiXmlMetaDeArchivo, metaCfdiUtil, type CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";
import { findProveedorByRfcEnOrg } from "@/features/proveedor/services/duplicadoRfc";
import { notifyError } from "@/lib/ui/appFeedback";

export interface ProveedorDetectado {
  id: string;
  nombre: string;
}

interface Args {
  organizationId: string;
}

export function useSubirEntranteForm({ organizationId }: Args) {
  const [pdf, setPdf] = useState<File | null>(null);
  const [xml, setXml] = useState<File | null>(null);
  const [meta, setMeta] = useState<CfdiXmlMeta | null>(null);
  const [proveedor, setProveedor] = useState<ProveedorDetectado | null>(null);
  const [proveedorDetectado, setProveedorDetectado] = useState<ProveedorDetectado | null>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [leyendoXml, setLeyendoXml] = useState(false);

  const limpiar = useCallback(() => {
    setPdf(null);
    setXml(null);
    setMeta(null);
    setProveedor(null);
    setProveedorDetectado(null);
    setNota("");
    setError(null);
  }, []);

  const procesarXml = useCallback(async (archivo: File) => {
    setLeyendoXml(true);
    try {
      const leido = await extraerCfdiXmlMetaDeArchivo(archivo);
      setMeta(leido);
      const encontrado = leido.rfcEmisor
        ? await findProveedorByRfcEnOrg(leido.rfcEmisor, organizationId)
        : null;
      setProveedorDetectado(encontrado);
      // Sugerencia: sólo prellena si el operador aún no eligió a mano.
      if (encontrado) setProveedor((actual) => actual ?? encontrado);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo leer el XML; puedes subirlo igual y contabilidad lo revisará.",
        error: e,
        method: "LEER_XML_ENTRANTE",
      });
      setMeta(null);
    } finally {
      setLeyendoXml(false);
    }
  }, [organizationId]);

  /** Acepta una selección múltiple y la acomoda en las dos ranuras. */
  const agregarArchivos = useCallback((archivos: readonly File[]) => {
    const pareja = emparejarArchivosEntrantes(archivos, { pdf, xml });
    setPdf(pareja.pdf);
    setXml(pareja.xml);
    setError(
      pareja.ignorados.length > 0
        ? "Sólo se usa un PDF y un XML por factura; los demás archivos se ignoraron."
        : validarParejaEntrante({ pdf: pareja.pdf, xml: pareja.xml }),
    );
    if (pareja.xml && pareja.xml !== xml) void procesarXml(pareja.xml);
  }, [pdf, xml, procesarXml]);

  const quitarPdf = useCallback(() => { setPdf(null); setError(null); }, []);
  const quitarXml = useCallback(() => {
    setXml(null);
    setMeta(null);
    setProveedorDetectado(null);
    setError(null);
  }, []);

  const metaUtil = useMemo(() => (meta ? metaCfdiUtil(meta) : false), [meta]);
  // Exige proveedor: un documento sin dueño obliga a contabilidad a adivinar.
  const listo = Boolean(
    (pdf || xml) && proveedor && !leyendoXml && !validarParejaEntrante({ pdf, xml }),
  );

  return {
    pdf, xml, meta, metaUtil, proveedor, proveedorDetectado, nota, error, leyendoXml, listo,
    setProveedor, setNota, setError, agregarArchivos, quitarPdf, quitarXml, limpiar,
  };
}
