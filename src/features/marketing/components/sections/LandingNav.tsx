import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { ProbarDemoButton } from "@/features/marketing/components/ProbarDemoButton";
import { ROUTES } from "@/constants/routes";

const links = [
  { href: "#recorrido", label: "Recorrido" },
  { href: "#modulos", label: "Módulos" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#precio", label: "Precio" },
  { href: "#recursos", label: "Recursos" },
  { href: "#faq", label: "Preguntas" },
];


export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to={ROUTES.LANDING} className="flex shrink-0 items-center gap-2.5" aria-label="Libre Carga">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-surface p-1 ring-1 ring-border/40 shadow-sm">
            <img src="/librecarga-logo.webp" alt="" className="h-full w-full object-contain" />
          </span>
          <span className="whitespace-nowrap text-lg font-semibold tracking-tight text-foreground">
            Libre Carga
          </span>
        </Link>


        <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to={ROUTES.LOGIN}>Iniciar sesión</Link>
          </Button>
          <ProbarDemoButton size="sm" variant="outline" />
          <Button asChild size="sm">
            <Link to={ROUTES.LOGIN_SIGNUP}>Crear cuenta gratis</Link>
          </Button>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-foreground lg:hidden"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

      </div>

      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3" aria-label="Móvil">

            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={ROUTES.LOGIN}>Iniciar sesión</Link>
              </Button>
              <Button asChild size="sm">
                <Link to={ROUTES.LOGIN_SIGNUP}>Crear cuenta</Link>
              </Button>
              <ProbarDemoButton size="sm" variant="secondary" className="col-span-2" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
