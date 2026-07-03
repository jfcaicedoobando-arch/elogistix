## Mi recomendación (dos preguntas del usuario)

### 1) Botón "Guardar cambios" — mi opinión

**Recomiendo eliminarlo, pero NO condicionar el guardado al timbrado.** Auto-guardar sólo cuando se timbra tiene tres problemas:

- Un **borrador** se puede editar sin timbrarlo (queda pendiente días) y perderías `notas`, `días de crédito` y TC al recargar.
- Facturas **ya timbradas** siguen aceptando edición de metadata (notas, días crédito, TC informativo). Sin evento de timbrar, esos cambios se perderían.
- Rompe la simetría con otras cards del sistema (Emisor, Receptor, Datos generales de proforma) donde el guardado es explícito.

**Propuesta:** auto-guardado silencioso "on blur" (cuando sales del campo o cierras el select), con un pequeño indicador `Guardado ✓` en la esquina de la card. La lógica de sincronización que ya existe en `DialogTimbrarFactura` (que persiste Uso CFDI / Forma / Método justo antes de timbrar) se mantiene como red de seguridad.

**Analogía:** como Google Docs. No hay botón "Guardar" — apenas dejas de escribir, se guarda solo, y ves "Guardado" arriba a la derecha.

### 2) Reemplazar Frankfurter con Banxico — sí, pero con cuidados

Sí conviene unificar. Banxico es la fuente legal (Art. 20 CFF) y ya la usamos para CFDI. Pero Frankfurter tiene dos ventajas que hay que reproducir antes de apagarlo:

- Sin token y sin rate limit → hoy podemos llamarlo desde cualquier hook sin caché.
- Rápido, siempre responde algo.

Banxico SIE tiene cuota diaria por token (~1000 req/día) y latencia mayor. Si migramos sin caché fuerte, cada carga de dashboard/embarque consumiría la cuota.

**Propuesta:** reescribir internamente `exchange-rates` para que consulte Banxico (SF43718 + SF46410) manteniendo el mismo contrato `{ usdMxn, eurMxn }`. Añadir caché en memoria dentro de la edge function (12 h — el DOF publica una vez al día) más fallback conservador si Banxico falla. Los cuatro consumidores existentes (`useEmbarqueForm`, `useDashboardEjecutivoFacturacion`, `DialogRegistrarPago`, `FacturasEmitidasFooter`) no cambian su código.

---

## Alcance técnico

### Cambio 1 — Auto-save en `FacturaDatosFiscalesCard`

- Quitar el botón "Guardar cambios" y el `<form onSubmit>`.
- Debounce por campo (300 ms) sobre el mutation `actualizarDatosTimbradoFactura`.
- Indicador visual sutil: `Guardando…` / `Guardado ✓ hace X seg` en el `CardHeader` (patrón existente en otros lugares).
- El botón "Obtener TC DOF de hoy (USD/EUR)" también auto-guarda al aplicar (deja de haber estado inconsistente).
- `DialogTimbrarFactura` sigue haciendo su save-antes-de-timbrar como red de seguridad (no lo tocamos).
- Test unitario: cambio → debounce → llamada al servicio; error → toast con `notifyError`.

### Cambio 2 — Migrar TC global a Banxico

- **Reescribir `supabase/functions/exchange-rates/index.ts**` para consultar en paralelo las series `SF43718` (USD/MXN FIX) y `SF46410` (EUR/MXN) de Banxico usando `BANXICO_SIE_TOKEN`.
- Mismo contrato de respuesta: `{ usdMxn: number, eurMxn: number }`. Ningún consumidor cliente cambia.
- Caché in-memory por 12 h dentro de la function (evita agotar la cuota diaria).
- Fallback: si Banxico falla, mantener los valores actuales (`{ usdMxn: 17.25, eurMxn: 18.5 }`) — mismo comportamiento que hoy con Frankfurter caído.
- **Eliminar `supabase/functions/banxico-tipo-cambio/**` — su lógica se absorbe. El botón "Obtener TC DOF" pasa a llamar directamente a `exchange-rates` y extrae el campo de la moneda correspondiente.
- **Textos**: renombrar en UI/glosario/landing el "Frankfurter.app" por "Banxico (DOF, Art. 20 CFF)".
- Ajustar tests de arquitectura Sentry (quitar `banxico-tipo-cambio/index.ts` de las listas).
- Actualizar `useBanxicoTipoCambio` para consumir `exchange-rates` (mantiene su API pública).

### Archivos afectados

```text
edit    supabase/functions/exchange-rates/index.ts
delete  supabase/functions/banxico-tipo-cambio/index.ts
edit    src/features/facturacion/hooks/useBanxicoTipoCambio.ts
edit    src/features/facturacion/components/detalle/FacturaDatosFiscalesCard.tsx
edit    src/__tests__/architecture/sentry-edge-wrapping.test.ts
edit    src/__tests__/architecture/sentry-edge-coverage.test.ts
edit    src/features/dashboard/routes/ayudaGlosario.ts
edit    src/features/marketing/routes/landingCopy.ts
edit    CHANGELOG.md + APP_VERSION → 13.166.0
new     src/features/facturacion/components/detalle/__tests__/FacturaDatosFiscalesCard.autosave.test.tsx
```

### Riesgos y mitigaciones

- **Cuota Banxico** → caché 12 h in-memory + fallback.
- **Fin de semana / feriados** → el endpoint `datos/oportuno` regresa el último publicado; correcto para CFDI.
- **Auto-save durante escritura rápida** → debounce 300 ms + `useMutation` con `mutationKey` para cancelar peticiones obsoletas.

¿Sigo con esta ruta o prefieres alguna variante (p. ej. mantener Frankfurter para el dashboard pero Banxico sólo para facturas)? Adelante con esta ruta