/**
 * Autocarga del documento del buzón dentro del formulario de captura.
 *
 * v13.366.0 — Descarga el XML (o el PDF, para proveedor extranjero) desde el
 * bucket del buzón y lo pasa por el mismo parser que usa la carga manual, para
 * que el contador vea el formulario ya prellenado sin volver a arrastrar nada.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [intento, setIntento] = useState(0);
  const procesadoRef = useRef<string | null>(null);
  const enCursoRef = useRef<string | null>(null);
  const cbRef = useRef({ onCfdiParsed, onPdfParsed, categorias });
  cbRef.current = { onCfdiParsed, onPdfParsed, categorias };

  useEffect(() => {
    if (!abierto || !entrante || !organizationId) return;
    // Idempotencia: sólo se marca "procesado" tras un ÉXITO real, así que un
    // fallo deja el ref libre para reintentar sin cerrar el diálogo.
    if (procesadoRef.current === entrante.id) return;
    const claveIntento = `${entrante.id}#${intento}`;
    if (enCursoRef.current === claveIntento) return;
    enCursoRef.current = claveIntento;
    let cancelado = false;

    const fallar = (msg: string) => {
      setEstado("error");
      setMensaje(msg);
    };

    const correr = async () => {
      setEstado("cargando");
      setMensaje(null);
      try {
        let ok: void | boolean;
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
          ok = await cbRef.current.onCfdiParsed(data, { xml, pdf });
        } else {
          const pdf = await descargarArchivoEntranteComoFile(
            entrante.archivoPath,
            entrante.nombreArchivo,
          );
          const data = await parsePdfInvoice(pdf, cbRef.current.categorias, organizationId);
          if (cancelado) return;
          ok = await cbRef.current.onPdfParsed(data, { pdf });
        }
        if (cancelado) return;
        // `false` explícito = el formulario rechazó los datos: es un fallo,
        // no un "listo" (antes se pintaba éxito con el formulario vacío).
        if (ok === false) {
          fallar("No se pudieron aplicar los datos del documento. Reintenta la lectura o captura a mano.");
          return;
        }
        procesadoRef.current = entrante.id;
        setEstado("listo");
      } catch (error) {
        if (cancelado) return;
        fallar(getErrorMessage(error));
      }
    };

    void correr();
    return () => { cancelado = true; };
  }, [abierto, entrante, organizationId, intento]);

  useEffect(() => {
    if (!abierto) {
      procesadoRef.current = null;
      enCursoRef.current = null;
      setIntento(0);
      setEstado("idle");
      setMensaje(null);
    }
  }, [abierto]);

  const reintentar = useCallback(() => {
    if (procesadoRef.current) return;
    setIntento((n) => n + 1);
  }, []);

  return { estado, mensaje, reintentar };
}
