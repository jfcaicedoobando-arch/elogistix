import { useEffect } from "react";

/**
 * Reemplazo ligero de react-helmet-async para evitar el conflicto de
 * múltiples copias de React que rompe la app (ThemeProvider crash).
 * Maneja imperativamente <title>, <meta> y <link rel="canonical"> y un
 * bloque opcional de JSON-LD.
 */
interface SeoProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  /** Tipo Open Graph. Usar "article" en guías/recursos. Default: "website". */
  ogType?: "website" | "article";
  /** URL absoluta (https) de la imagen de previsualización social. */
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}


function upsertMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function Seo({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogUrl,
  jsonLd,
}: SeoProps) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) upsertMeta("name", "description", description);
    if (canonical) upsertLink("canonical", canonical);
    if (ogTitle) upsertMeta("property", "og:title", ogTitle);
    if (ogDescription) upsertMeta("property", "og:description", ogDescription);
    if (ogUrl) upsertMeta("property", "og:url", ogUrl);

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      script.setAttribute("data-seo-jsonld", "true");
      document.head.appendChild(script);
    }
    return () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogUrl, jsonLd]);

  return null;
}
