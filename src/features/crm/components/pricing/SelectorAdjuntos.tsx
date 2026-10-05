/**
 * Botón "Adjuntar" + pegado de capturas (Ctrl+V) dentro del área.
 * Sólo entrega los archivos elegidos; quien lo usa decide cuándo subirlos.
 */
import { useRef, type ClipboardEvent } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onArchivos: (files: File[]) => void;
  disabled?: boolean;
}

export const ACCEPT_ADJUNTOS = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.msg,.eml";

export function SelectorAdjuntos({ onArchivos, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    onArchivos(files.map((f, i) => (f.name && f.name !== "image.png"
      ? f : new File([f], `captura-${Date.now()}-${i + 1}.png`, { type: f.type || "image/png" }))));
  };

  return (
    <div tabIndex={0} onPaste={onPaste}
      className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring">
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
        <Paperclip className="mr-2 h-4 w-4" /> Adjuntar archivo
      </Button>
      <span>o haz clic aquí y pega una captura (Ctrl+V). Máx. 10 MB por archivo.</span>
      <input ref={input} type="file" multiple hidden accept={ACCEPT_ADJUNTOS}
        onChange={(e) => { onArchivos(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </div>
  );
}
