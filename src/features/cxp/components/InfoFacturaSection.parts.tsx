/**
 * Sub-piezas UI de `InfoFacturaSection` extraídas para mantener el archivo
 * principal < 200 líneas (Power of 10).
 */
import { toast } from "sonner";
import { ExternalLink, Loader2, ShieldCheck, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { openFacturaInNewTab } from "@/services/storage/facturas";
import { notifyError } from "@/components/shared/utils/appFeedback";

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

async function handleAbrir(path: string, tipo: "XML" | "PDF") {
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

export function AdjuntoRow({
  label, icon, path, tipo,
}: { label: string; icon: React.ReactNode; path: string | null; tipo: "XML" | "PDF" }) {
  const adjunto = !!path;
  const badgeCls = tipo === "XML"
    ? "bg-accent/10 text-accent"
    : "bg-destructive/10 text-destructive";
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
      {adjunto && (
        <Button variant="ghost" size="sm" className="h-7 px-2 opacity-60 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); handleAbrir(path, tipo); }}>
          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
        </Button>
      )}
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
