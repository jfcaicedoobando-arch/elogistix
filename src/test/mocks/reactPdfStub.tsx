/**
 * Stub ligero de @react-pdf/renderer para la suite de tests.
 *
 * Razón: el módulo real arrastra fontkit, pdfkit y polyfills de stream que
 * inflan la carga inicial de cada archivo de test ~200-400ms y sostienen
 * caches difíciles de liberar entre suites (causa raíz del OOM intermitente).
 * Aliasamos el módulo a este stub en `vitest.config.ts` (`resolve.alias`) para
 * que ninguna importación —ni `vi.importActual`— cargue el módulo real.
 *
 * Los tests usan `getByTestId("pdf-doc" | "pdf-page" | ...)` para verificar
 * que el árbol se monta; el binario PDF no se valida en ninguna suite.
 *
 * Si en el futuro algún test necesita el módulo real, hay que crear una
 * configuración de Vitest separada que omita este alias.
 */
import type { ReactNode, CSSProperties } from "react";

type ChildrenProps = { children?: ReactNode; style?: CSSProperties; [k: string]: unknown };

export const Document = ({ children }: ChildrenProps) => (
  <div data-testid="pdf-doc">{children}</div>
);
export const Page = ({ children }: ChildrenProps) => (
  <div data-testid="pdf-page">{children}</div>
);
export const View = ({ children }: ChildrenProps) => (
  <div data-testid="pdf-view">{children}</div>
);
export const Text = ({ children }: ChildrenProps) => (
  <div data-testid="pdf-text">{children}</div>
);
export const Image = () => <div data-testid="pdf-image" />;
export const Link = ({ children }: ChildrenProps) => (
  <a data-testid="pdf-link">{children}</a>
);
export const Svg = ({ children }: ChildrenProps) => (
  <svg data-testid="pdf-svg">{children}</svg>
);
export const G = ({ children }: ChildrenProps) => <g>{children}</g>;
export const Path = () => <path />;
export const Rect = () => <rect />;
export const Circle = () => <circle />;
export const Line = () => <line />;
export const Polygon = () => <polygon />;

export const StyleSheet = {
  create: <T,>(styles: T): T => styles,
  flatten: <T,>(s: T): T => s,
};

export const Font = {
  register: (): void => {},
  registerHyphenationCallback: (): void => {},
  registerEmojiSource: (): void => {},
  getRegisteredFonts: (): string[] => [],
  clear: (): void => {},
};

// pdf(): usado por descargarPdf.ts → devuelve toBlob/toBuffer mockeables.
export const pdf = (): {
  toBlob: () => Promise<Blob>;
  toBuffer: () => Promise<Uint8Array>;
  toString: () => Promise<string>;
} => ({
  toBlob: () => Promise.resolve(new Blob([""], { type: "application/pdf" })),
  toBuffer: () => Promise.resolve(new Uint8Array()),
  toString: () => Promise.resolve(""),
});

export const PDFViewer = ({ children }: ChildrenProps) => (
  <div data-testid="pdf-viewer">{children}</div>
);
export const PDFDownloadLink = ({ children }: ChildrenProps) => (
  <div data-testid="pdf-download-link">
    {typeof children === "function"
      ? (children as (p: { loading: boolean; blob: null; url: null; error: null }) => ReactNode)({
          loading: false,
          blob: null,
          url: null,
          error: null,
        })
      : children}
  </div>
);
export const BlobProvider = PDFDownloadLink;

export default {
  Document, Page, View, Text, Image, Link, Svg, G, Path, Rect, Circle, Line, Polygon,
  StyleSheet, Font, pdf, PDFViewer, PDFDownloadLink, BlobProvider,
};
