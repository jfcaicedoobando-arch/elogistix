# Sin acción requerida

El fix ya está en el repositorio desde `v13.320.9`.

`src/features/cotizacion/components/revalidacion/CrearEmbarqueConRevalidacion.tsx:169` ya usa el token semántico `text-warning`:

```tsx
{bloqueadoPorEsquema ? <AlertTriangle className="h-4 w-4 mr-2 text-warning" /> : null}
```

El log que compartiste corresponde a una corrida previa a ese commit. No hay migración, edición ni bump de versión pendiente.

Si en algún momento el test vuelve a fallar, el flujo es el mismo: sustituir el literal `text-{paleta}-{tono}` por el token semántico correspondiente (`text-warning`, `text-destructive`, `text-success`, `text-info`, `text-muted-foreground`) en lugar de agregarlo a la allowlist.
