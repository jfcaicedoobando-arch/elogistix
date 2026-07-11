# Orden recomendado frente a la migración a React 19

**Corta:** haz **Fase A + B ahora**, **pospón Fase C** hasta después de React 19.

## Por qué

Piensa en cada fase como un ladrillo:

- **Fase A (concurrencia)** y **Fase B (cleanup de effects)** son *ladrillos que sirven en las dos casas* — funcionan igual en React 18 y en 19. Cada día que esperas, es un día más de UI lenta y de posibles leaks. No hay trabajo tirado.
- **Fase C (memoización manual de filas)** es *un ladrillo que reemplaza el que trae la casa nueva gratis*. El compiler de React 19 memoiza automáticamente. Si lo haces a mano hoy, cuando migres tendrás que quitar `React.memo` para no duplicar trabajo. Es esfuerzo desechable.

## Matriz de compatibilidad

| Fase | Beneficio en React 18 | Requiere retoque tras subir a 19 | Recomendación |
|---|---|---|---|
| A · `useDeferredValue` / `useTransition` en filtros y tabs | Alto (latencia percibida) | No | **Hacer ahora** |
| B · Auditar cleanup de 104 effects | Alto (menos leaks) | No | **Hacer ahora** |
| C · `React.memo` en filas de tabla | Medio | Sí — el compiler lo vuelve redundante | **Esperar a React 19** |

## Bonus: qué migración a 19 te desbloquea automáticamente

- **Compiler**: memoización automática — hace la Fase C sola.
- **`ref` como prop**: los 116 `forwardRef` de shadcn se pueden simplificar.
- **Actions y `useOptimistic`**: reemplazan patrones actuales de mutaciones + `isPending` manuales en react-query, útil en formularios de embarques/cotizaciones.
- **`use()` para promises**: simplifica algunos patrones de Suspense.

## Plan concreto que propongo ejecutar

1. **Ahora — Fase A**: aplicar `useDeferredValue` en filtros de GlobalSearch, listado de embarques, listado de cotizaciones y listado de clientes. `useTransition` en cambios de tab pesados.
2. **Ahora — Fase B**: subagente inventaría los 104 archivos con `useEffect`, filtra los que crean canales Supabase / listeners / timers sin cleanup, y aplico fixes en lote.
3. **Después de React 19 (fase separada)**: revisar tablas y decidir si el compiler ya cubre C; si no, memoizar filas puntualmente. En el mismo turno, migrar `forwardRef` → `ref` prop en shadcn y probar Actions en un formulario piloto.

## Detalles técnicos

- Fase A y B no tocan `package.json` ni versiones — sólo código de aplicación. Son 100% forward-compatible con React 19.
- Fase C sí conflictúa con el compiler de 19 (no rompe, pero duplica trabajo).
- Cuando Lovable habilite React 19, migrar es: bump de `react`/`react-dom`/`@types/react` + habilitar `babel-plugin-react-compiler` (o el equivalente SWC) + typecheck. Fases A y B no requieren retoque.

¿Ejecuto **Fase A + B** ahora? Confirma y arranco.
