/**
 * Comprobación de despliegue: ¿la web pública sirve la misma versión que el
 * código de esta rama?
 *
 * Motivo (v13.823.317): un smoke test reportó `v13.823.306` en el sidebar de
 * producción cuando la rama ya iba en `13.823.315`. Este script permite
 * distinguir en segundos entre "falta publicar" y "el navegador tiene un
 * bundle viejo en caché".
 *
 * Uso:
 *   bun run check:published-version                 # https://librecarga.com
 *   bun run check:published-version https://otra.app
 *
 * Salida: 0 si la versión publicada coincide con `APP_VERSION`; 1 si difiere o
 * no se pudo determinar. No toca datos ni reglas de negocio: sólo lee HTTP.
 */
import { readAppVersion } from "./lib/readAppVersion";

const DEFAULT_URL = "https://librecarga.com";

/** Extrae las rutas de los bundles JS referenciados por el HTML publicado. */
function extraerBundles(html: string): string[] {
  const rutas = new Set<string>();
  const re = /(?:src|href)="([^"]+\.js)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) rutas.add(m[1]);
  return [...rutas];
}

/**
 * Busca la versión de la app dentro de un bundle servido. Se restringe a la
 * serie de la rama (`13.823.*`) para no confundirla con versiones de librerías
 * (React, etc.) que también viajan en el bundle.
 */
function extraerVersion(texto: string, local: string): string | null {
  const [mayor, menor] = local.split(".");
  const re = new RegExp(`${mayor}\\.${menor}\\.\\d+`);
  return texto.match(re)?.[0] ?? null;
}

async function versionPublicada(baseUrl: string, local: string): Promise<string | null> {
  const html = await (await fetch(baseUrl, { cache: "no-store" })).text();
  for (const ruta of extraerBundles(html)) {
    const url = ruta.startsWith("http") ? ruta : new URL(ruta, baseUrl).toString();
    const js = await (await fetch(url, { cache: "no-store" })).text();
    const encontrada = extraerVersion(js, local);
    if (encontrada) return encontrada;
  }
  return null;
}

async function main(): Promise<void> {
  const baseUrl = process.argv[2] ?? DEFAULT_URL;
  const local = readAppVersion();
  const publicada = await versionPublicada(baseUrl);

  if (!publicada) {
    console.error(`❌ No se pudo leer la versión publicada en ${baseUrl}.`);
    process.exit(1);
  }
  if (publicada !== local) {
    console.error(
      `❌ Desfase de despliegue: ${baseUrl} sirve v${publicada} y la rama va en v${local}.\n` +
        "   Publica de nuevo desde Lovable (los cambios de frontend requieren publicar).",
    );
    process.exit(1);
  }
  console.log(`✅ ${baseUrl} sirve v${publicada} == APP_VERSION local.`);
}

void main();
