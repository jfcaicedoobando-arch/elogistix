# Inter for internal PDF documents

Inter matches the app's `font-sans` in `tailwind.config.ts`. Licensed under SIL OFL 1.1 (included).
Source: https://github.com/google/fonts/tree/main/ofl/inter (retrieved 2026-10-07).

The WOFF files contain the static instances of the official variable sources, generated with fontTools at optical size 14 and weights 400 and 600. Italic uses the official italic source. WOFF compression preserves the original characters and metrics, including Latin, Greek and Cyrillic. The internal PDF renderer loads these assets from the app.

The complete license is also shipped as `public/licenses/inter/OFL.txt` with production assets. Word wrapping uses advance widths derived from the same static instances. Update `text/interAdvanceWidths.ts` if the source font changes.
