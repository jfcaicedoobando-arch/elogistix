import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X } from "lucide-react";
import { useToast } from "@/hooks/shared/useToast";

const MAX_IMAGES = 3;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

interface Props {
  value: File[];
  onChange: (files: File[]) => void;
  enabled?: boolean;
}

export function FeedbackImageUploader({ value, onChange, enabled = true }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const addFiles = (files: File[]) => {
    const valid: File[] = [];
    for (const f of files) {
      if (!ALLOWED.includes(f.type)) {
        toast({ title: "Formato no permitido", description: f.name, variant: "destructive" });
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast({ title: "Imagen demasiado grande (máx 5MB)", description: f.name, variant: "destructive" });
        continue;
      }
      valid.push(f);
    }
    const next = [...value, ...valid].slice(0, MAX_IMAGES);
    onChange(next);
  };

  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const it of items) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length) {
        e.preventDefault();
        addFiles(imgs);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, value]);

  const previews = value.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={value.length >= MAX_IMAGES}
        >
          <ImagePlus className="h-4 w-4 mr-1.5" />
          Adjuntar imagen
        </Button>
        <span className="text-xs text-muted-foreground">
          {value.length}/{MAX_IMAGES} · también puedes pegar con Ctrl+V
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          const fs = Array.from(e.target.files ?? []);
          addFiles(fs);
          e.target.value = "";
        }}
      />
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative group rounded-md border overflow-hidden bg-muted aspect-video">
              <img src={p.url} alt={`Adjunto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 rounded-full bg-foreground/70 text-background p-0.5 opacity-0 group-hover:opacity-100 transition"
                aria-label="Quitar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
