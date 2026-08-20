import { useId, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { esDiaInhabilMx, motivoInhabilMx } from "@/lib/date/festivosMx";
import {
  PICKER_AYUDA_TECLADO, PLACEHOLDER_FECHA_HORA, pickerAvisoClass, pickerClearClass,
  pickerClearIconClass, pickerErrorClass, pickerIconClass, pickerRootClass, pickerTriggerClass,
} from "@/components/ui/picker-mx-shell";
import { Hint } from "@/components/shared/Hint";
import { dateToIso, isoToDate } from "./date-picker-mx-helpers";
import { PATRON_FECHA_HORA } from "./date-picker-mx-segmentos";
import { manejarAtajosSegmento, seleccionarSegmentoEnCursor } from "./date-picker-mx-teclado";
import {
  HORA_DEFAULT, useDateTimePickerMxValor, valorADisplay,
} from "./date-time-picker-mx-valor";

interface DateTimePickerMxProps {
  /** Valor tipo `datetime-local`: `YYYY-MM-DDTHH:mm` (o vacío). */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  disabled?: boolean;
  errorText?: string | null;
  id?: string;
  /** Aviso ámbar (no bloquea) si la fecha cae en fin de semana o festivo oficial. */
  avisarInhabil?: boolean;
}

/**
 * DateTime picker localizado para México (`DD/MM/AAAA HH:MM`).
 *
 * v13.614.0 — se captura con teclado numérico (máscara dirigida por dígitos) y
 * comparte los aceleradores de `DatePickerMx`: `T` = hoy, `+`/`-` sobre el
 * segmento activo (día, mes, año, hora o minuto), `←`/`→` para cambiar de
 * segmento y `F4` para abrir el calendario.
 */
export function DateTimePickerMx({
  value, onChange, placeholder = PLACEHOLDER_FECHA_HORA, className, title,
  disabled = false, errorText, id, avisarInhabil = false,
}: DateTimePickerMxProps) {
  const autoErrorId = useId();
  const errorId = id ? `${id}-error` : autoErrorId;
  const avisoId = `${id ?? autoErrorId}-aviso`;
  const [open, setOpen] = useState(false);
  const {
    text, invalid, inputRef, iso, hora, commit, handleChange, emitir, limpiar,
  } = useDateTimePickerMxValor(value, onChange);

  const showError = invalid || !!errorText;
  const aviso = !showError && avisarInhabil && iso ? motivoInhabilMx(iso) : null;
  const describedBy = [showError ? errorId : null, aviso ? avisoId : null]
    .filter(Boolean).join(" ") || undefined;

  const emitirFecha = (nuevoIso: string, nuevaHora = hora) => {
    if (!nuevoIso) { limpiar(); return; }
    emitir(`${nuevoIso}T${nuevaHora || HORA_DEFAULT}`);
  };

  return (
    <div className={cn(pickerRootClass, className)}>
      <Hint label={title ?? PICKER_AYUDA_TECLADO}>
      <div
        role="group"
        aria-label={title}
        aria-disabled={disabled || undefined}
        className={cn(pickerTriggerClass({ showError, disabled }))}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleChange}
          onFocus={() => seleccionarSegmentoEnCursor(inputRef.current, PATRON_FECHA_HORA)}
          onClick={() => seleccionarSegmentoEnCursor(inputRef.current, PATRON_FECHA_HORA)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              return;
            }
            if (e.key === "F4" || (e.altKey && e.key === "ArrowDown")) {
              e.preventDefault();
              setOpen(!open);
              return;
            }
            if (e.key === "Enter") {
              commit(text);
              if (text !== valorADisplay(value)) e.preventDefault();
              return;
            }
            manejarAtajosSegmento(e, {
              patron: PATRON_FECHA_HORA,
              base: iso,
              aplicar: (nuevoIso) => emitirFecha(nuevoIso),
              inputRef,
              disabled,
            });
          }}
          onBlur={() => commit(text)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={id ? undefined : (title ?? placeholder)}
          aria-invalid={showError || undefined}
          aria-describedby={describedBy}
          maxLength={16}
          className="flex-1 min-w-0 bg-transparent text-body outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        {text && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              limpiar();
            }}
            className={pickerClearClass}
            aria-label="Limpiar fecha"
          >
            <X className={pickerClearIconClass} />
          </button>
        )}

        <Popover
          open={open}
          onOpenChange={(o) => {
            if (disabled) return;
            setOpen(o);
            if (!o) inputRef.current?.focus();
          }}
        >
          <Hint label="Abrir calendario (Alt + Flecha abajo)">
            <PopoverTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                aria-label="Abrir calendario"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed"
              >
                <CalendarIcon className={pickerIconClass} />
              </button>
            </PopoverTrigger>
          </Hint>
          <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
            <Calendar
              mode="single"
              selected={isoToDate(iso)}
              onSelect={(d) => emitirFecha(d ? dateToIso(d) : "")}
              modifiers={avisarInhabil ? { inhabil: (d: Date) => esDiaInhabilMx(dateToIso(d)) } : undefined}
              modifiersClassNames={avisarInhabil ? { inhabil: "text-warning" } : undefined}
              autoFocus
              locale={es}
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="border-t p-3 flex items-center gap-2">
              <span className="text-body-sm text-muted-foreground">Hora</span>
              <Input
                type="time"
                value={hora}
                onChange={(e) => emitirFecha(iso, e.target.value)}
                className="h-9 w-32"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
      </Hint>
      {showError && (
        <span id={errorId} className={pickerErrorClass}>
          {errorText ?? "Fecha inválida. Usa DD/MM/AAAA HH:MM."}
        </span>
      )}
      {aviso && (
        <span id={avisoId} role="status" className={pickerAvisoClass}>
          Día inhábil: {aviso}
        </span>
      )}
    </div>
  );
}
