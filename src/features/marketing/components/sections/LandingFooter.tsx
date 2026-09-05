import { Link } from "react-router-dom";
import { Mail, ExternalLink } from "lucide-react";
import { FOOTER } from "../../routes/landingCopy";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-surface p-1 ring-1 ring-border/40 shadow-sm">
                <img src="/librecarga-logo.webp" alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
              </span>
              <span className="text-base font-semibold tracking-tight text-foreground">
                Libre Carga
              </span>
            </div>

            <p className="mt-3 max-w-sm text-sm text-muted-foreground">{FOOTER.tagline}</p>
            <a
              href={`mailto:${FOOTER.contact}`}
              className="mt-4 inline-flex items-center gap-2 text-sm text-foreground transition-colors hover:text-accent"
            >
              <Mail className="h-4 w-4" /> {FOOTER.contact}
            </a>
            <a
              href={`https://${FOOTER.site}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-accent"
            >
              {FOOTER.site} <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <FooterCol title="Producto" links={[
            { label: "Demo", href: "#demo" },
            { label: "Módulos", href: "#modulos" },
            { label: "Cómo funciona", href: "#como-funciona" },
            { label: "Precio", href: "#precio" },
          ]} />
          <FooterCol title="Recursos" links={[
            { label: "Guía Carta Porte 3.0", to: "/recursos/guia-carta-porte-3" },
            { label: "Guía Incoterms 2020", to: "/recursos/guia-incoterms-2020" },
            { label: "Preguntas frecuentes", href: "#faq" },
            { label: "Contacto", href: `mailto:${FOOTER.contact}` },
          ]} />
          <FooterCol title="Acceso" links={[
            { label: "Iniciar sesión", to: "/login" },
            { label: "Crear cuenta gratis", to: "/login?tab=signup" },
            { label: "Portal del cliente", to: "/login" },
          ]} />
          <FooterCol title="Legal" links={[
            { label: "Seguridad y privacidad", to: "/legal/seguridad" },
            { label: "Aviso de privacidad", to: "/legal/privacidad" },
            { label: "Términos y condiciones", to: "/legal/terminos" },
            { label: "Contacto", href: `mailto:${FOOTER.contact}` },
          ]} />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>{FOOTER.copyright}</span>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1">
              Hecho en México
            </span>
          </div>
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
