/**
 * Sub-piezas UI de `InfoFacturaSection` extraídas para mantener el archivo
 * principal < 200 líneas (Power of 10).
 * v13.307.5 — AdjuntoRow ahora permite adjuntar/reemplazar/quitar el archivo
 * cuando el usuario tiene permiso de edición.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ExternalLink, Loader2, ShieldCheck, Ban, Upload, RefreshCcw, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { openFacturaInNewTab } from "@/services/storage/facturas";
import { notifyError } from "@/components/shared/utils/appFeedback";
import type { TipoAdjuntoCfdi } from "@/features/cxp/services";

export function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-label uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className={`text-sm text-foreground truncate ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

async function handleAbrir(path: string, tipo: TipoAdjuntoCfdi) {
  try {
    await openFacturaInNewTab(path);
  } catch (e) {
    notifyError(toast, {
      title: `No se pudo abrir el ${tipo} del CFDI`,
      error: e,
      method: "FEATURES_CXP_INFOFACTURA_OPEN_CFDI",
    });
  }
}

const MAX_BYTES: Record<TipoAdjuntoCfdi, number> = {
  XML: 2 * 1024 * 1024,
  PDF: 10 * 1024 * 1024,
};

function acceptFor(tipo: TipoAdjuntoCfdi): string {
  return tipo === "XML" ? ".xml,text/xml,application/xml" : "application/pdf";
}

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

  const pickFile = () => inputRef.current?.click();

  const handleFile = (file: File | null) => {
    if (!file || !onUpload) return;
    const err = validarArchivo(file, tipo);
    if (err) {
      notifyError(toast, { title: err, method: "CXP_ADJUNTO_ROW_VALIDATE" });
      return;
    }
    if (adjunto) setConfirmReplace(file);
    else onUpload(file, tipo);
  };

  return (
    <div
      className={`group flex items-center justify-between gap-3 rounded-md border bg-muted/30 hover:bg-background transition-colors px-3 py-2 ${adjunto ? "cursor-pointer" : "opacity-70"}`}
      onClick={() => { if (adjunto) handleAbrir(path, tipo); }}
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
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {adjunto && (
          <Button variant="ghost" size="sm" className="h-7 px-2 opacity-60 group-hover:opacity-100"
            onClick={() => handleAbrir(path, tipo)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
          </Button>
        )}
        {canEdit && onUpload && (
          <>
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
            <Button
              variant="ghost" size="sm" className="h-7 px-2"
              disabled={isUploading}
              onClick={pickFile}
              title={adjunto ? `Reemplazar ${tipo}` : `Adjuntar ${tipo}`}
            >
              {isUploading
                ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                : adjunto
                  ? <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                  : <Upload className="h-3.5 w-3.5 mr-1" />}
              {adjunto ? "Reemplazar" : "Adjuntar"}
            </Button>
          </>
        )}
        {canEdit && adjunto && onRemove && (
          <Button
            variant="ghost" size="sm" className="h-7 px-2 text-destructive"
            disabled={isUploading}
            onClick={() => setConfirmRemove(true)}
            title={`Quitar ${tipo}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <AlertDialog open={!!confirmReplace} onOpenChange={(o) => !o && setConfirmReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar el {tipo} actual?</AlertDialogTitle>
            <AlertDialogDescription>
              El archivo existente se sobreescribirá con
              <span className="font-medium"> {confirmReplace?.name}</span>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReplace && onUpload) onUpload(confirmReplace, tipo);
                setConfirmReplace(null);
              }}
            >
              Reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar el {tipo} adjunto?</AlertDialogTitle>
            <AlertDialogDescription>
              La factura permanecerá, pero ya no tendrá el archivo {tipo}. Podrás adjuntar uno nuevo después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (path && onRemove) onRemove(path, tipo);
                setConfirmRemove(false);
              }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function CanceladaBanner({ fecha, motivo }: { fecha: string | null; motivo: string | null }) {
  const fechaTxt = fecha
    ? new Date(fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
    : null;
  return (
    <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <Ban className="h-3.5 w-3.5" /> Factura cancelada{fechaTxt ? ` · ${fechaTxt}` : ""}
      </div>
      {motivo && (
        <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
          <span className="font-medium">Motivo:</span> {motivo}
        </p>
      )}
    </div>
  );
}

export function UuidFiscalField({
  uuid, estatus, verifDate, isPending, onVerify,
}: {
  uuid: string | null;
  estatus: string | null;
  verifDate: string | null;
  isPending: boolean;
  onVerify: () => void;
}) {
  const variant: "default" | "secondary" | "destructive" =
    estatus === "Vigente" ? "default" : estatus === "Cancelado" ? "destructive" : "secondary";
  return (
    <div className="flex flex-col gap-1 min-w-0 col-span-2 md:col-span-1">
      <span className="text-label uppercase tracking-wider text-muted-foreground font-medium">
        UUID fiscal (CFDI)
      </span>
      <span className="text-sm text-foreground truncate font-mono">
        {uuid ?? <span className="text-muted-foreground font-sans">—</span>}
      </span>
      {uuid && (
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {estatus && (
            <Badge variant={variant} className="text-2xs">
              SAT: {estatus}
            </Badge>
          )}
          {verifDate && (
            <span className="text-2xs text-muted-foreground">
              Verificado {verifDate}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-label"
            disabled={isPending}
            onClick={onVerify}
          >
            {isPending
              ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              : <ShieldCheck className="h-3 w-3 mr-1" />}
            Verificar en SAT
          </Button>
        </div>
      )}
    </div>
  );
}
