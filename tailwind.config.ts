import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // v13.423.0 — Breakpoint por ALTO de pantalla. Las laptops de 720-768 px
      // dejan muy poco cuerpo útil en los modales largos (captura de facturas):
      // con `short:` se compactan ayudas y descripciones sin tocar el diseño
      // de las pantallas grandes.
      screens: {
        short: { raw: "(max-height: 800px)" },
      },

      fontFamily: {
        sans: ["Inter", "sans-serif"],
        // v13.139.18 (F-03 auditoría 3): stack defensivo para emoji.
        // Antes `font-emoji` se aplicaba en FinanceHeader/Dashboard sin estar
        // declarado en Tailwind, así que el emoji 👋 caía al sans default y
        // se renderizaba como cuadro vacío (`Buenos días □`) en entornos
        // sin Apple Color Emoji. Ahora forzamos las fuentes de emoji nativas
        // de cada sistema operativo.
        emoji: [
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji",
          "EmojiOne Color",
          "Android Emoji",
          "sans-serif",
        ],
      },
      fontSize: {
        // Tipografía fluida (Fase 6) — clamp(min, preferida, max).
        // Ola 9 · Armonización global: el título de página bajó de 36px a 28px máx.
        // A 1280x720 el h1 de 36px + descripción consumía ~120px y sólo dejaban ver
        // 4 filas de tabla; 28px alinea la densidad con ERPs tipo Odoo/QuickBooks.
        display: ["clamp(1.375rem, 1.15rem + 0.9vw, 1.75rem)", { lineHeight: "1.2", fontWeight: "700" }],
        kpi: ["clamp(1.125rem, 0.95rem + 0.8vw, 1.5rem)", { lineHeight: "1.2", fontWeight: "600" }],
        // Ola 7 · Lote A — escalones extra-pequeños para chips, badges y footnotes.
        // Reemplazan los ~25 usos de `text-[10px]` y aislados `text-[9px]` en `src/features/**`.
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        "3xs": ["0.5625rem", { lineHeight: "0.75rem" }],
        // Ola 8 · Auditoría UI 1080p — reemplaza los ~129 usos de `text-[11px]`
        // en chips, footers de tabla y etiquetas densas.
        label: ["0.6875rem", { lineHeight: "1rem" }],
      },

      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        /** Superficie de fila seleccionada (buscador global, paletas de comandos). */
        selection: {
          DEFAULT: "hsl(var(--selection-surface))",
          foreground: "hsl(var(--selection-surface-foreground))",
        },

        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        "brand-surface": "hsl(var(--brand-surface))",
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        kpi: {
          info:      { DEFAULT: "hsl(var(--kpi-info))",      soft: "hsl(var(--kpi-info-soft))" },
          success:   { DEFAULT: "hsl(var(--kpi-success))",   soft: "hsl(var(--kpi-success-soft))" },
          accent:    { DEFAULT: "hsl(var(--kpi-accent))",    soft: "hsl(var(--kpi-accent-soft))" },
          warning:   { DEFAULT: "hsl(var(--kpi-warning))",   soft: "hsl(var(--kpi-warning-soft))" },
          secondary: { DEFAULT: "hsl(var(--kpi-secondary))", soft: "hsl(var(--kpi-secondary-soft))" },
          danger:    { DEFAULT: "hsl(var(--kpi-danger))",    soft: "hsl(var(--kpi-danger-soft))" },
        },
        // Ola 7 · Lote A — expuestos como color Tailwind para poder escribir `bg-state-llegada/10`
        // sin caer en `bg-[hsl(var(--state-llegada))]`.
        // Lote 3B (v13.300.2) — añadidos estados operativos (arribo/aduana/eir/operacion)
        // y modos de transporte (aereo/multimodal) que antes usaban literales Tailwind.
        state: {
          llegada: "hsl(var(--state-llegada))",
          "en-proceso": "hsl(var(--state-en-proceso))",
          cerrado: "hsl(var(--state-cerrado))",
          arribo:    { DEFAULT: "hsl(var(--state-arribo))",    soft: "hsl(var(--state-arribo-soft))" },
          aduana:    { DEFAULT: "hsl(var(--state-aduana))",    soft: "hsl(var(--state-aduana-soft))" },
          eir:       { DEFAULT: "hsl(var(--state-eir))",       soft: "hsl(var(--state-eir-soft))" },
          operacion: { DEFAULT: "hsl(var(--state-operacion))", soft: "hsl(var(--state-operacion-soft))" },
        },
        mode: {
          aereo:      { DEFAULT: "hsl(var(--mode-aereo))",      soft: "hsl(var(--mode-aereo-soft))" },
          multimodal: { DEFAULT: "hsl(var(--mode-multimodal))", soft: "hsl(var(--mode-multimodal-soft))" },
        },
        // Lote 3B (v13.300.6) — escala de aging (5 niveles) para cartera vencida.
        aging: {
          1: "hsl(var(--aging-1))",
          2: "hsl(var(--aging-2))",
          3: "hsl(var(--aging-3))",
          4: "hsl(var(--aging-4))",
          5: "hsl(var(--aging-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-lg)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
        // v13.424.0 — Barras sticky (footers de wizard, CTA móvil): antes usaban
        // `shadow-[0_-8px_24px_-12px_rgba(0,0,0,.4)]` con negro literal.
        "sticky-top": "var(--shadow-sticky-top)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
