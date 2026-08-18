/**
 * Vista previa de QA del logo de Libre Carga sobre distintos fondos
 * y en distintos estados (default, hover, activo). Sirve para validar
 * legibilidad y contraste antes de propagar cambios al landing.
 *
 * Ruta: /logo-preview (pública, no indexable).
 */
import { Link } from "react-router-dom";
import { Seo } from "@/components/shared/Seo";
import { useEffect } from "react";

type Tone = "light" | "muted" | "navy" | "accent" | "image";

const SURFACES: Array<{ id: Tone; label: string; className: string; textClass: string; subClass: string }> = [
  {
    id: "light",
    label: "Fondo claro (superficie base)",
    className: "bg-background",
    textClass: "text-foreground",
    subClass: "text-muted-foreground",
  },
  {
    id: "muted",
    label: "Fondo gris suave (muted)",
    className: "bg-muted",
    textClass: "text-foreground",
    subClass: "text-muted-foreground",
  },
  {
    id: "navy",
    label: "Fondo navy (landing actual)",
    className: "bg-primary",
    textClass: "text-primary-foreground",
    subClass: "text-primary-foreground/70",
  },
  {
    id: "accent",
    label: "Fondo accent",
    className: "bg-accent",
    textClass: "text-accent-foreground",
    subClass: "text-accent-foreground/80",
  },
  {
    id: "image",
    label: "Sobre imagen / degradado",
    className:
      "bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent)/0.55),transparent_60%),radial-gradient(circle_at_80%_70%,hsl(var(--accent)/0.35),transparent_55%),linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.75))]",
    textClass: "text-primary-foreground",
    subClass: "text-primary-foreground/80",
  },
];

type StateKey = "default" | "hover" | "active";

const STATES: Array<{ id: StateKey; label: string; ring: string; scale: string }> = [
  { id: "default", label: "Default", ring: "ring-border/40", scale: "scale-100" },
  { id: "hover", label: "Hover (ring acento)", ring: "ring-2 ring-accent/60", scale: "scale-[1.03]" },
  { id: "active", label: "Active (pressed)", ring: "ring-2 ring-accent", scale: "scale-[0.97]" },
];

function Lockup({
  textClass,
  subClass,
  state,
  size = "md",
}: {
  textClass: string;
  subClass: string;
  state: StateKey;
  size?: "sm" | "md" | "lg";
}) {
  const boxSize = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const textSize = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg";
  const sub = STATES.find((s) => s.id === state)!;
  return (
    <div className={`inline-flex items-center gap-2.5 transition-transform ${sub.scale}`}>
      <span
        className={`flex ${boxSize} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card p-1 shadow-sm ring-1 ${sub.ring}`}
      >
        <img src="/librecarga-logo.webp" alt="" className="h-full w-full object-contain" />
      </span>
      <span className={`whitespace-nowrap font-semibold tracking-tight ${textSize} ${textClass}`}>
        Libre Carga
      </span>
      <span className={`hidden text-xs ${subClass} sm:inline`}>· {sub.label}</span>
    </div>
  );
}

export default function LogoPreview() {
  // Página interna de QA — bloquear indexación
  useEffect(() => {
    let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !el;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "robots");
      document.head.appendChild(el);
    }
    const prev = el.getAttribute("content");
    el.setAttribute("content", "noindex, nofollow");
    return () => {
      if (created && el?.parentNode) el.parentNode.removeChild(el);
      else if (el && prev !== null) el.setAttribute("content", prev);
    };
  }, []);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="QA logo · Libre Carga"
        description="Vista interna de QA del lockup del logo de Libre Carga sobre distintos fondos y estados."
        canonical="https://librecarga.com/logo-preview"
        ogTitle="QA logo · Libre Carga"
        ogDescription="Vista interna de QA del logo de Libre Carga."
        ogUrl="https://librecarga.com/logo-preview"
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Logo · Vista previa QA</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Valida legibilidad del lockup en los fondos y estados que aparecen en el landing.
            </p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Volver al landing
          </Link>
        </div>

        <div className="space-y-6">
          {SURFACES.map((s) => (
            <section
              key={s.id}
              className={`overflow-hidden rounded-2xl border border-border/40 ${s.className}`}
            >
              <div className="flex items-center justify-between border-b border-border/40 px-5 py-2.5">
                <span className={`text-xs font-medium uppercase tracking-wider ${s.subClass}`}>
                  {s.label}
                </span>
                <span className={`text-2xs ${s.subClass}`}>3 estados · 3 tamaños</span>
              </div>

              <div className="grid gap-6 px-5 py-8 sm:grid-cols-3">
                {STATES.map((state) => (
                  <div key={state.id} className="flex flex-col items-start gap-4">
                    <span className={`text-label uppercase tracking-wider ${s.subClass}`}>
                      {state.label}
                    </span>
                    <Lockup textClass={s.textClass} subClass={s.subClass} state={state.id} size="sm" />
                    <Lockup textClass={s.textClass} subClass={s.subClass} state={state.id} size="md" />
                    <Lockup textClass={s.textClass} subClass={s.subClass} state={state.id} size="lg" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Esta vista es solo para QA visual. No está enlazada desde el menú público.
        </p>
      </div>
    </div>
  );
}
