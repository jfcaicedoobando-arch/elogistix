/**
 * EmailChipsField — Campo tipo etiquetas (chips) para captura de correos.
 *
 * Homologa la interacción de "Para" y "CC" en el modal de envío de documentos.
 * - Enter, coma, punto y coma o Tab confirman el chip.
 * - Backspace en input vacío elimina el último chip editable.
 * - Pegado (paste) auto-divide por comas/espacios/saltos.
 * - Chips inválidos se resaltan en `destructive`.
 * - `lockedChips` son chips no removibles (p.ej. usuario logueado en CC).
 *
 * El componente NO gestiona duplicados; el caller decide cómo tratar
 * `value` (por ejemplo, dedupear case-insensitive).
 */
import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import { Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPLIT_RE = /[,;\s]+/;

export interface EmailChip {
  email: string;
  /** Etiqueta corta a mostrar antes del correo (nombre o tipo). */
  label?: string;
  /** Badge secundario, p.ej. "principal", "facturación". */
  tag?: string;
  /** Marcado si el chip es inválido (email malformado). */
  invalid?: boolean;
}

export interface LockedChip {
  email: string;
  label?: string;
  tooltip?: string;
}

interface Props {
  id?: string;
  chips: EmailChip[];
  lockedChips?: LockedChip[];
  onAdd: (email: string) => void;
  onRemove: (email: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export function EmailChipsField({
  id,
  chips,
  lockedChips = [],
  onAdd,
  onRemove,
  placeholder = "escribe un correo y presiona Enter…",
  ariaLabel,
}: Props) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const parts = raw.split(SPLIT_RE).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) onAdd(p);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
      if (value.trim()) {
        e.preventDefault();
        commit(value);
        setValue("");
      }
    } else if (e.key === "Backspace" && value === "" && chips.length > 0) {
      e.preventDefault();
      const last = chips[chips.length - 1];
      onRemove(last.email);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (SPLIT_RE.test(text)) {
      e.preventDefault();
      commit(text);
      setValue("");
    }
  };

  const handleBlur = () => {
    setFocused(false);
    if (value.trim()) {
      commit(value);
      setValue("");
    }
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm transition-colors",
        "min-h-10 cursor-text",
        focused ? "ring-2 ring-ring ring-offset-0 border-ring" : "border-input",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {lockedChips.map((c) => (
        <Badge
          key={`locked-${c.email}`}
          variant="secondary"
          className="gap-1 pl-1.5 pr-2 font-normal"
          title={c.tooltip ?? c.email}
          data-testid="envio-chip-locked"
          data-locked="true"
        >
          <Lock className="h-3 w-3 opacity-60" aria-hidden />
          <span className="truncate max-w-[220px]">{c.label ?? c.email}</span>
        </Badge>
      ))}

      {chips.map((c) => (
        <Badge
          key={c.email}
          variant={c.invalid ? "destructive" : "secondary"}
          className="gap-1 pl-2 pr-1 font-normal"
          title={c.email}
        >
          <span className="truncate max-w-[220px]">
            {c.label ? (
              <>
                <span className="font-medium">{c.label}</span>{" "}
                <span className="opacity-70">&lt;{c.email}&gt;</span>
              </>
            ) : (
              c.email
            )}
          </span>
          {c.tag && (
            <span className="rounded bg-background/60 px-1 text-[10px] uppercase tracking-wide">
              {c.tag}
            </span>
          )}
          <button
            type="button"
            aria-label={`Quitar ${c.email}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(c.email);
            }}
            className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <input
        ref={inputRef}
        id={id}
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder={chips.length === 0 && lockedChips.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[160px] bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

export { EMAIL_RE as EMAIL_CHIP_RE };
