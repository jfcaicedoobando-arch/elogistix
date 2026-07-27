/**
 * `<AdjuntoRow />` — Renglón de adjunto CFDI (XML o PDF) con acciones
 * Abrir / Adjuntar / Reemplazar / Quitar y confirmaciones destructivas.
 * v13.307.17 — Extraído de `InfoFacturaSection.parts.tsx` para bajar
 *              complejidad ciclomática y respetar el límite de 250 líneas.
 */
import { useRef, useState } from "react";
import {
  ExternalLink, Loader2, Upload, RefreshCcw, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { openFacturaInNewTab } from "@/services/storage/facturas";
import { ConfirmReplaceDialog, ConfirmRemoveDialog } from "./AdjuntoRow.dialogs";
import { notifyError } from "@/lib/ui/appFeedback";
import type { TipoAdjuntoCfdi } from "@/features/cxp/services";

const MAX_BYTES: Record<TipoAdjuntoCfdi, number> = {
  XML: 2 * 1024 * 1024,
  PDF: 10 * 1024 * 1024,
};

const acceptFor = (tipo: TipoAdjuntoCfdi): string =>
  tipo === "XML" ? ".xml,text/xml,application/xml" : "application/pdf";

function validarArchivo(file: File, tipo: TipoAdjuntoCfdi): string | null {
  const ext = file.name.toLowerCase().split(".").pop();
  if (tipo === "XML" && ext !== "xml") return "El archivo debe ser .xml";
  if (tipo === "PDF" && ext !== "pdf") return "El archivo debe ser .pdf";
  if (file.size > MAX_BYTES[tipo]) {
    const mb = (MAX_BYTES[tipo] / (1024 * 1024)).toFixed(0);
    return `El ${tipo} excede ${mb} MB`;
  }
  return null;
}

async function handleAbrir(path: string, tipo: TipoAdjuntoCfdi) {
  try {
    await openFacturaInNewTab(path);
  } catch (e) {
    notifyError(undefined, {
      title: `No se pudo abrir el ${tipo} del CFDI`,
      error: e,
      method: "FEATURES_CXP_INFOFACTURA_OPEN_CFDI",
    });
  }
}

interface AdjuntoRowProps {
  label: string;
  icon: React.ReactNode;
  path: string | null;
  tipo: TipoAdjuntoCfdi;
  canEdit?: boolean;
  isUploading?: boolean;
  onUpload?: (file: File, tipo: TipoAdjuntoCfdi) => void;
  onRemove?: (path: string, tipo: TipoAdjuntoCfdi) => void;
}

/**
 * Acciones lado derecho del renglón (Abrir / Adjuntar / Reemplazar / Quitar).
 * Extraído para bajar la complejidad ciclomática de `AdjuntoRow` a <16.
 */
function AdjuntoActions({
  path, tipo, canEdit, isUploading, adjunto, onPickFile, onAskRemove, onUpload, onRemove,
}: {
  path: string | null;
  tipo: TipoAdjuntoCfdi;
  canEdit: boolean;
  isUploading: boolean;
  adjunto: boolean;
  onPickFile: () => void;
  onAskRemove: () => void;
  onUpload?: AdjuntoRowProps["onUpload"];
  onRemove?: AdjuntoRowProps["onRemove"];
}) {
  const iconoAccion = isUploading
    ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
    : adjunto
      ? <RefreshCcw className="h-3.5 w-3.5 mr-1" />
      : <Upload className="h-3.5 w-3.5 mr-1" />;
  return (
    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      {adjunto && path && (
        <Button variant="ghost" size="sm" className="h-7 px-2 opacity-60 group-hover:opacity-100"
          onClick={() => handleAbrir(path, tipo)}>
          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
        </Button>
      )}
      {canEdit && onUpload && (
        <Button
          variant="ghost" size="sm" className="h-7 px-2"
          disabled={isUploading}
          onClick={onPickFile}
          title={adjunto ? `Reemplazar ${tipo}` : `Adjuntar ${tipo}`}
        >
          {iconoAccion}
          {adjunto ? "Reemplazar" : "Adjuntar"}
        </Button>
      )}
      {canEdit && adjunto && onRemove && (
        <Button
          variant="ghost" size="sm" className="h-7 px-2 text-destructive"
          disabled={isUploading}
          onClick={onAskRemove}
          title={`Quitar ${tipo}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function AdjuntoRow({
  label, icon, path, tipo, canEdit = false, isUploading = false, onUpload, onRemove,
}: AdjuntoRowProps) {
  const adjunto = !!path;
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmReplace, setConfirmReplace] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const badgeCls = tipo === "XML"
    ? "bg-accent/10 text-accent"
    : "bg-destructive/10 text-destructive";

  const handleFile = (file: File | null) => {
    if (!file || !onUpload) return;
    const err = validarArchivo(file, tipo);
    if (err) {
      notifyError(undefined, { title: err, method: "CXP_ADJUNTO_ROW_VALIDATE" });
      return;
    }
    if (adjunto) setConfirmReplace(file);
    else onUpload(file, tipo);
  };

  return (
    <div
      className={`group flex items-center justify-between gap-3 rounded-md border bg-muted/30 hover:bg-background transition-colors px-3 py-2 ${adjunto ? "cursor-pointer" : "opacity-70"}`}
      onClick={() => { if (adjunto && path) handleAbrir(path, tipo); }}
      role={adjunto ? "button" : undefined}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold ${badgeCls}`}>
          {icon}
          {label}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {adjunto ? "Adjunto" : "No adjunto"}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={acceptFor(tipo)}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          handleFile(f);
        }}
      />

      <AdjuntoActions
        path={path} tipo={tipo} canEdit={canEdit} isUploading={isUploading}
        adjunto={adjunto}
        onPickFile={() => inputRef.current?.click()}
        onAskRemove={() => setConfirmRemove(true)}
        onUpload={onUpload} onRemove={onRemove}
      />

      <ConfirmReplaceDialog
        file={confirmReplace}
        tipo={tipo}
        onCancel={() => setConfirmReplace(null)}
        onConfirm={(file) => {
          if (onUpload) onUpload(file, tipo);
          setConfirmReplace(null);
        }}
      />

      <ConfirmRemoveDialog
        open={confirmRemove}
        tipo={tipo}
        onOpenChange={setConfirmRemove}
        onConfirm={() => {
          if (path && onRemove) onRemove(path, tipo);
          setConfirmRemove(false);
        }}
      />

    </div>
  );
}
