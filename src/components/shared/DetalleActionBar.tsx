/**
 * DetalleActionBar — barra de acciones unificada para las páginas de detalle
 * a las que llegan los drilldowns de las bandejas (Factura, Proforma,
 * Embarque > tab Facturación).
 *
 * Layout:
 *   [Primary] [Sec1] [Sec2] [Sec3]  [⋮ Más]           [Destructive]
 *
 * Reglas:
 * - `primary`: 1 botón sólido (CTA fiscal/operativa del estado actual).
 * - `secondary`: hasta MAX_SECONDARY visibles como outline. El resto se
 *   empuja automáticamente al menú "Más" para no saturar el header.
 * - `more`: siempre dentro de un DropdownMenu (cerrado por defecto).
 * - `destructive`: aislado a la derecha con divider vertical.
 *
 * El componente NO decide qué acciones mostrar; sólo renderiza las listas
 * declarativas que le pasa la página. Mantiene < 200 líneas (Power of 10 #4).
 */
import { Link } from "react-router-dom";
import { Loader2, MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Máximo de acciones secundarias visibles antes de empujar al menú "Más". */
const MAX_SECONDARY = 3;

export interface DetalleActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Color del ícono en la variante outline (ej: "text-destructive"). */
  iconClassName?: string;
  /** Tono destructivo (rojo). Sólo aplica en secondary/more. */
  destructive?: boolean;
}

interface Props {
  /** Acción primaria (botón sólido). */
  primary?: DetalleActionItem | null;
  /** Acciones secundarias visibles (outline). Overflow va a `more`. */
  secondary?: DetalleActionItem[];
  /** Acciones adicionales que viven en el menú "Más". */
  more?: DetalleActionItem[];
  /** Botón destructivo aislado a la derecha. */
  destructive?: DetalleActionItem | null;
  /** Etiqueta del trigger del dropdown (default: "Más acciones"). */
  moreLabel?: string;
  className?: string;
}

function ItemIcon({ item }: { item: DetalleActionItem }) {
  if (item.loading) return <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden />;
  const Icon = item.icon;
  return <Icon className={cn("h-4 w-4 mr-1.5", item.iconClassName)} aria-hidden />;
}

function OutlineButton({ item }: { item: DetalleActionItem }) {
  const destructiveCls = item.destructive
    ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
    : "";
  if (item.href && !item.disabled) {
    return (
      <Button variant="outline" size="sm" asChild className={destructiveCls}>
        <Link to={item.href} aria-label={item.label}>
          <ItemIcon item={item} />
          {item.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={item.onClick}
      disabled={item.disabled || item.loading}
      className={destructiveCls}
    >
      <ItemIcon item={item} />
      {item.label}
    </Button>
  );
}

function MoreMenu({ items, label }: { items: DetalleActionItem[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={label}>
          <MoreHorizontal className="h-4 w-4 mr-1.5" aria-hidden />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        {items.map((it) => {
          const Icon = it.icon;
          const destructiveCls = it.destructive
            ? "text-destructive focus:text-destructive focus:bg-destructive/10"
            : "";
          const content = (
            <>
              {it.loading
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                : <Icon className={cn("h-4 w-4 mr-2", it.iconClassName)} aria-hidden />}
              {it.label}
            </>
          );
          if (it.href && !it.disabled) {
            return (
              <DropdownMenuItem key={it.id} asChild disabled={it.disabled || it.loading} className={destructiveCls}>
                <Link to={it.href}>{content}</Link>
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem
              key={it.id}
              onClick={it.onClick}
              disabled={it.disabled || it.loading}
              className={destructiveCls}
            >
              {content}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DetalleActionBar({
  primary,
  secondary = [],
  more = [],
  destructive,
  moreLabel = "Más acciones",
  className,
}: Props) {
  // Overflow: hasta MAX_SECONDARY visibles; el resto se apila al inicio de `more`.
  const visibles = secondary.slice(0, MAX_SECONDARY);
  const overflow = secondary.slice(MAX_SECONDARY);
  const menuItems = [...overflow, ...more];

  const nothing = !primary && visibles.length === 0 && menuItems.length === 0 && !destructive;
  if (nothing) return null;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="toolbar"
      aria-label="Acciones del detalle"
    >
      {primary && (
        <Button size="sm" onClick={primary.onClick} disabled={primary.disabled || primary.loading}>
          <ItemIcon item={primary} />
          {primary.label}
        </Button>
      )}
      {visibles.map((it) => <OutlineButton key={it.id} item={it} />)}
      <MoreMenu items={menuItems} label={moreLabel} />
      {destructive && (
        <>
          <div className="mx-1 h-6 w-px self-center bg-border ml-auto" aria-hidden />
          <OutlineButton item={{ ...destructive, destructive: true }} />
        </>
      )}
    </div>
  );
}
