import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { FOOTER } from "../landingCopy";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <img src="/librecarga-icon.svg" alt="" className="h-7 w-7" />
              <span className="text-base font-semibold text-primary">Libre Carga</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">{FOOTER.tagline}</p>
            <a
              href={`mailto:${FOOTER.contact}`}
              className="mt-4 inline-flex items-center gap-2 text-sm text-foreground transition-colors hover:text-accent"
            >
              <Mail className="h-4 w-4" /> {FOOTER.contact}
            </a>
          </div>

          <FooterCol title="Producto" links={[
            { label: "Módulos", href: "#modulos" },
            { label: "Cómo funciona", href: "#como-funciona" },
            { label: "Precio", href: "#precio" },
          ]} />
          <FooterCol title="Acceso" links={[
            { label: "Iniciar sesión", to: "/login" },
            { label: "Crear cuenta gratis", to: "/login" },
            { label: "Portal del cliente", to: "/login" },
          ]} />
          <FooterCol title="Legal" links={[
            { label: "Aviso de privacidad", href: "#" },
            { label: "Términos y condiciones", href: "#" },
            { label: "Contacto", href: `mailto:${FOOTER.contact}` },
          ]} />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>{FOOTER.copyright}</span>
          <span>Hecho con orgullo en México 🇲🇽</span>
        </div>
      </div>
    </footer>
  );
}

interface FooterLink { label: string; href?: string; to?: string }

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {l.label}
              </Link>
            ) : (
              <a href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {l.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
