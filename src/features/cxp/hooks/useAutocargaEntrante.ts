/**
 * Autocarga del documento del buzón dentro del formulario de captura.
 *
 * v13.366.0 — Descarga el XML (o el PDF, para proveedor extranjero) desde el
 * bucket del buzón y lo pasa por el mismo parser que usa la carga manual, para
 * que el contador vea el formulario ya prellenado sin volver a arrastrar nada.
 */
import { useEffect, useRef, useState } from "react";
import { parseCfdiXml, type CfdiParsedResponse } from "@/features/cxp/services";
import { parsePdfInvoice } from "@/features/cxp/services/parsePdfInvoice";
import { descargarArchivoEntranteComoFile } from "@/features/cxp/services/capturaEntrante";
import type { EntranteParaCaptura } from "@/features/cxp/types";
import { getErrorMessage } from "@/lib/errors";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

export type EstadoAutocarga = "idle" | "cargando" | "listo" | "error";

interface Args {
  entrante: EntranteParaCaptura | null | undefined;
  abierto: boolean;
  categorias: { id: string; nombre: string }[];
  onCfdiParsed: (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => Promise<void | boolean> | void;
  onPdfParsed: (data: CfdiParsedResponse, files: { pdf: File }) => Promise<void | boolean> | void;
}

export function useAutocargaEntrante({ entrante, abierto, categorias, onCfdiParsed, onPdfParsed }: Args) {
  const { organizationId } = useOrgActiva();
  const [estado, setEstado] = useState<EstadoAutocarga>("idle");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const procesadoRef = useRef<string | null>(null);
  const cbRef = useRef({ onCfdiParsed, onPdfParsed, categorias });
  cbRef.current = { onCfdiParsed, onPdfParsed, categorias };

  useEffect(() => {
    if (!abierto || !entrante || !organizationId) return;
    if (procesadoRef.current === entrante.id) return;
    procesadoRef.current = entrante.id;
    let cancelado = false;

    const correr = async () => {
      setEstado("cargando");
      setMensaje(null);
      try {
        if (entrante.xmlPath) {
          const xml = await descargarArchivoEntranteComoFile(
            entrante.xmlPath,
            entrante.xmlNombre ?? "cfdi.xml",
          );
          const pdf = entrante.archivoPath.toLowerCase().endsWith(".pdf")
            ? await descargarArchivoEntranteComoFile(entrante.archivoPath, entrante.nombreArchivo)
            : null;
          const data = await parseCfdiXml(xml, cbRef.current.categorias, organizationId);
          if (cancelado) return;
          await cbRef.current.onCfdiParsed(data, { xml, pdf });
        } else {
          const pdf = await descargarArchivoEntranteComoFile(
            entrante.archivoPath,
            entrante.nombreArchivo,
          );
          const data = await parsePdfInvoice(pdf, cbRef.current.categorias, organizationId);
          if (cancelado) return;
          await cbRef.current.onPdfParsed(data, { pdf });
        }
        if (!cancelado) setEstado("listo");
      } catch (error) {
        if (cancelado) return;
        setEstado("error");
        setMensaje(getErrorMessage(error));
      }
    };

    void correr();
    return () => { cancelado = true; };
  }, [abierto, entrante, organizationId]);

  useEffect(() => {
    if (!abierto) {
      procesadoRef.current = null;
      setEstado("idle");
      setMensaje(null);
    }
  }, [abierto]);

  return { estado, mensaje };
}
