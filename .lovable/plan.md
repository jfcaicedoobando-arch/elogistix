# Por qué los usuarios ven toasts de colores distintos

Hoy el `Toaster` global (`src/components/ui/sonner.tsx`) tiene la prop **`richColors`** activada. Con esa prop, Sonner pinta cada toast con un fondo distinto según la severidad:

| Tipo | Fondo actual | Dónde se usa |
|---|---|---|
| `toast.error` / `notifyError` | rojo | 340+ call sites de error |
| `toast.success` / `notifySuccess` | verde | 82 call sites (guardados, timbrado, etc.) |
| `toast.warning` / `notifyWarning` | ámbar | 15 call sites (SAT retry, avisos) |
| `toast.info` | azul | 10 call sites (SAT pending, "cancelación enviada") |
| `toast(...)` (neutro) | blanco/gris | 47 call sites (CRM, mensajes simples) |

**Analogía**: es como si cada aviso de la app viniera en un post-it de color distinto — rojo, verde, amarillo, azul, blanco. Individualmente cada color tiene sentido, pero cuando el usuario ve varios seguidos siente que la app "cambia de idioma" en cada mensaje.

Además hay una inconsistencia real: los mismos flujos usan tanto `toast.info` (azul) como `toast(...)` (neutro) para mensajes informativos equivalentes → mismo tipo de aviso, dos colores.

# Recomendación (patrón moderno tipo Linear/Vercel)

Un solo color de fondo para TODOS los toasts (superficie `--card` sobre `--background`), y la severidad se comunica sólo por:

1. **Icono a color** (círculo rojo/verde/ámbar/azul, ya viene de Sonner).
2. **Borde izquierdo de 3 px** con el color semántico.
3. **Título con peso** consistente (14 px semibold, ya existe).

Ventajas:
- Look calmado, "Apple-like minimal" que ya rige el proyecto (mem://core).
- Elimina el choque visual al encolar avisos de distinto tipo.
- Mantiene la accesibilidad (icono + borde + texto son 3 canales de severidad, no sólo color).
- Cero cambios en los ~450 call sites: sigue siendo `notifyError` / `toast.success` / etc.

# Cambios concretos (sólo presentación)

**Único archivo a tocar:** `src/components/ui/sonner.tsx`

1. Quitar `richColors`.
2. En `toastOptions.classNames.toast`, usar tokens semánticos del design system: `bg-card text-card-foreground border-border`.
3. Añadir variantes por `data-type` (Sonner las expone) para el borde izquierdo y el color del icono, usando tokens ya definidos:
   - `data-[type=error]`: `border-l-4 border-l-destructive`, icono `text-destructive`.
   - `data-[type=success]`: `border-l-4 border-l-primary` (o un token `--success` si preferimos añadirlo), icono en verde.
   - `data-[type=warning]`: `border-l-4 border-l-amber-500` (token `--warning` si lo agregamos), icono ámbar.
   - `data-[type=info]` y toast neutro: `border-l-4 border-l-muted`, sin icono destacado.
4. Consolidar `toast.info` con toast neutro (no separar visualmente informativo de neutro) — se logra automáticamente al usar el mismo estilo para ambos.

Nada más se toca: `appFeedback.ts`, `useToast` shim, `crmToast` y todos los call sites quedan igual.

# Verificación

- Screenshot manual con Playwright a Full HD disparando un toast de cada severidad para confirmar el look unificado.
- Los tests de arquitectura que ya prohíben `toast.error(...)` directo y `variant: destructive` siguen protegiendo el uso correcto.

# CHANGELOG y versión

- Bump `APP_VERSION` a `13.301.61`.
- Entrada nueva en `CHANGELOG.md` bajo Ajustes de UI: "Unificado el color de fondo de todos los toasts; la severidad ahora se comunica por icono y borde izquierdo".

# ¿Quieres una variante?

Si prefieres mantener el fondo coloreado para errores (para que un error de veras "grite"), puedo ajustar el plan para dejar SÓLO `error` con fondo rojo suave y el resto en superficie neutra. Dime antes de implementar si prefieres esa versión "1 color acentuado + resto neutro".
