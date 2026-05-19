import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Bug, Lightbulb, MousePointerClick, X } from "lucide-react";
import { FeedbackImageUploader } from "./FeedbackImageUploader";
import { useElementPicker, type PickedElement } from "@/hooks/feedback/useElementPicker";
import type { TipoReporteFeedback } from "@/types/feedback";

export interface FeedbackFormValues {
  tipo: TipoReporteFeedback;
  titulo: string;
  descripcion: string;
  elemento: PickedElement | null;
  imagenes: File[];
}

interface Props {
  initialUrl: string;
  submitting: boolean;
  onSubmit: (v: FeedbackFormValues) => void;
  onCancel: () => void;
  onPickerActiveChange?: (active: boolean) => void;
}

export function FeedbackForm({ initialUrl, submitting, onSubmit, onCancel, onPickerActiveChange }: Props) {
  const [tipo, setTipo] = useState<TipoReporteFeedback>("bug");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [elemento, setElemento] = useState<PickedElement | null>(null);
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const picker = useElementPicker((el) => {
    setElemento(el);
    onPickerActiveChange?.(false);
  });

  const startPicker = () => {
    onPickerActiveChange?.(true);
    picker.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (titulo.trim().length < 5) return setError("El título debe tener al menos 5 caracteres.");
    if (descripcion.trim().length < 10) return setError("La descripción debe tener al menos 10 caracteres.");
    setError(null);
    onSubmit({ tipo, titulo: titulo.trim(), descripcion: descripcion.trim(), elemento, imagenes });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="mb-2 block">Tipo de reporte</Label>
        <RadioGroup
          value={tipo}
          onValueChange={(v) => setTipo(v as TipoReporteFeedback)}
          className="grid grid-cols-2 gap-2"
        >
          <label className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition ${tipo === "bug" ? "border-destructive bg-destructive/5" : "hover:bg-muted/50"}`}>
            <RadioGroupItem value="bug" />
            <Bug className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">Bug</span>
          </label>
          <label className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition ${tipo === "mejora" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
            <RadioGroupItem value="mejora" />
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Mejora</span>
          </label>
        </RadioGroup>
      </div>

      <div>
        <Label htmlFor="fb-titulo">Título *</Label>
        <Input
          id="fb-titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Resumen breve del problema o sugerencia"
          maxLength={200}
        />
      </div>

      <div>
        <Label htmlFor="fb-desc">Descripción *</Label>
        <Textarea
          id="fb-desc"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="¿Qué estabas haciendo? ¿Qué esperabas y qué ocurrió?"
          rows={5}
          maxLength={4000}
        />
      </div>

      <div>
        <Label className="mb-1.5 block">Elemento (opcional)</Label>
        <div className="text-xs text-muted-foreground mb-2 truncate">URL: {initialUrl}</div>
        {elemento ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <Badge variant="secondary" className="font-mono text-[10px] truncate max-w-[200px]">{elemento.selector}</Badge>
            {elemento.texto && <span className="text-xs text-muted-foreground truncate flex-1">"{elemento.texto}"</span>}
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setElemento(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={startPicker} disabled={picker.active}>
            <MousePointerClick className="h-4 w-4 mr-1.5" />
            {picker.active ? "Selecciona un elemento..." : "Seleccionar elemento"}
          </Button>
        )}
      </div>

      <div>
        <Label className="mb-1.5 block">Imágenes (opcional)</Label>
        <FeedbackImageUploader value={imagenes} onChange={setImagenes} enabled={!picker.active} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <Button type="submit" disabled={submitting || picker.active}>
          {submitting ? "Enviando..." : "Enviar reporte"}
        </Button>
      </div>
    </form>
  );
}
