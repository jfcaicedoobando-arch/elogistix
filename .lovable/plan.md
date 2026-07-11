## Migración a React 19 — plan de ejecución

### Contexto y riesgo

- **Pin de Lovable**: el system prompt de la plataforma declara React 18 como stack oficial. Docs no confirman soporte para React 19. Migrar es viable técnicamente (react-day-picker 10, react-hook-form 7.81, TanStack Query 5, Radix, Sonner 1.7 y Sentry 10 ya son compatibles), pero el preview de Lovable puede requerir configuración extra o fallar. Vamos con red de rollback lista.
- **Superficie afectada**: 33 archivos usan `forwardRef` (todos son wrappers UI shadcn). El resto del codebase ya está React-19-ready gracias a Fase A+B.
- **Versión objetivo**: `react@19.0.2` + `react-dom@19.0.2` (última estable menor conservadora). `@types/react@19` y `@vitejs/plugin-react-swc@3.11+` ya soportan 19.

---

### Fase 0 — Snapshot y baseline (10 min)

1. Confirmar rama limpia y correr `bun run test:fast` + `bun run typecheck` para tener baseline verde.
2. Documentar el commit actual como punto de rollback (el usuario puede usar History si algo truena).

### Fase 1 — Bump de dependencias (20 min)

Actualizar `package.json`:

```text
react: ^18.3.1 → ^19.0.2
react-dom: ^18.3.1 → ^19.0.2
@types/react: ^18.3.31 → ^19.0.10
@types/react-dom: ^18.3.7 → ^19.0.4
@testing-library/react: ^16.3.2 → ^16.3.2 (ya soporta 19)
@vitejs/plugin-react-swc: ^3.11.0 → ^3.11.0 (ya soporta 19, verificar)
```

Instalar y correr `bun run typecheck` para atrapar breaks tempranos.

### Fase 2 — Codemod `forwardRef` → `ref` como prop (2 h)

React 19 permite `ref` como prop nativa en function components (`forwardRef` sigue funcionando pero está soft-deprecated). Refactor archivo por archivo, todos son wrappers shadcn con la misma forma:

```text
Antes:  const X = React.forwardRef<HTMLDivElement, Props>(({...}, ref) => <div ref={ref} .../>)
Ahora:  const X = ({ ref, ...props }: Props & { ref?: React.Ref<HTMLDivElement> }) => <div ref={ref} .../>
```

Orden (33 archivos, batch de 8):
1. `src/components/ui/*.tsx` (28 archivos)
2. `src/components/layout/{NavLink,AppSidebar}.tsx`
3. `src/components/shared/NumericInput.tsx`
4. Los 2 usos restantes fuera de UI

Después de cada batch: `bun run typecheck`.

### Fase 3 — Chequeos de compatibilidad puntuales (1 h)

- **StrictMode double-effects**: React 19 mantiene el comportamiento; nuestra Fase B ya confirmó 0 fugas en 104 `useEffect`.
- **`useRef` sin argumento inicial**: TS 19 lo marca error. Buscar `useRef<T>()` sin default y agregar `null`.
- **`ReactElement.props` deprecated en tipos**: revisar helpers que hagan `element.props` directo.
- **`propTypes` / `defaultProps` en function components**: buscar y eliminar (no debería haber, pero verificar).
- **Sonner 1.7.4**: pin verificado, funciona en 19. Si truena, subir a 1.8+.
- **react-helmet-async 3.0.0**: verificar que no tenga peer conflict con React 19; si sí, evaluar `@dr.pogodin/react-helmet` como reemplazo.

### Fase 4 — Verificación funcional (1 h)

1. `bun run typecheck` — 0 errores.
2. `bun run lint` — 0 errores.
3. `bun run test:fast` — 4538/4538 verdes.
4. `bun run build` — bundle producido sin warnings críticos.
5. Playwright headless contra `localhost:8080`:
   - Login con credenciales de auditoría (`mem://reference/audit-login`).
   - Abrir Dashboard, Cotizaciones, Embarques, Facturación.
   - Abrir un DatePicker (react-day-picker 10 sobre React 19).
   - Confirmar que no hay warnings de `ref` en consola.

### Fase 5 — Verificación del preview de Lovable (crítico)

Este es el punto de riesgo real. Después del bump:

1. Recargar el preview iframe.
2. Si carga y funciona → seguimos.
3. Si truena (pantalla en blanco, errores de hidratación, plugin de Lovable incompatible) → **rollback inmediato** vía History y reportamos hallazgo. Actualizamos `mem://constraint/lovable-stack-pins` con la evidencia.

### Fase 6 — Bookkeeping (10 min)

- Bump `APP_VERSION` a `13.267.0`.
- Entrada en `CHANGELOG.md` describiendo bump, refactor de forwardRef y validaciones.
- Actualizar `mem://constraint/lovable-stack-pins` removiendo React del pin (si Lovable aguantó) o reforzándolo (si hubo que revertir).

---

### Criterios de éxito

- `typecheck`, `lint`, `test:fast`, `build` verdes.
- Preview de Lovable carga sin errores de consola.
- Playwright confirma flujos críticos: login, tabla con virtualización, DatePicker, formularios RHF.
- 0 warnings de React 19 en consola de dev.

### Plan de rollback

Si Fase 5 falla: el usuario usa "View History" para revertir al mensaje previo al bump. Bump de `APP_VERSION` a `13.266.1` documentando el intento fallido. No dejamos código huérfano en main.

### Detalles técnicos

- **No hay dependency de React 18 en runtime**: verificado — `@react-pdf/renderer@4.5.1` soporta 19, `@dnd-kit/core@6.3.1` soporta 19, `recharts@2.15.4` soporta 19.
- **Compiler**: NO habilitamos el React Compiler en esta migración (fase separada). Sólo subimos runtime + types.
- **forwardRef sigue vivo**: no es un breaking change, sólo estamos limpiando para aprovechar la API nueva. Si el codemod da problemas en algún archivo, lo dejamos con `forwardRef` sin bloquear la fase.
- **Sin cambios de business logic**: sólo runtime + wrappers UI + tipos.
