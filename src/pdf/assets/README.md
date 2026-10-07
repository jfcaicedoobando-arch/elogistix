# Inter for internal PDF documents

Inter matches the app's `font-sans` in `tailwind.config.ts`. Licensed under SIL OFL 1.1 (included).
Source: https://github.com/google/fonts/tree/main/ofl/inter (retrieved 2026-10-07).

The TTF files are static instances of the official variable sources, generated with fontTools at optical size 14 and weights 400 / 600; italic uses the official italic source. Full character sets are retained, not a Latin-only subset. They are packaged with the app and loaded only with its internal PDF renderer. Exports never depend on a third-party font server. Inter covers Latin, Greek and Cyrillic; it is not a universal CJK or emoji font.

The complete license is also shipped as `public/licenses/inter/OFL.txt` with production assets. Word wrapping uses advance widths derived from these TTF files; update `text/interAdvanceWidths.ts` if the source font changes.
