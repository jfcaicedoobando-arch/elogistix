## Etapa 5 — Sub-loop 3: lazy charts + chunk de libphonenumber

### Diagnóstico

**recharts (`charts-vendor`, 348 KB gzip ~95 KB)**: hoy entra al primer paint de cualquiera de estas 5 rutas — `Reportes`, `Operaciones`, `AdminDashboard`, `Auditoria` (tab ejecutivo) y `DiagnosticoHealth` — porque los componentes que lo usan se importan estáticamente desde la página. El chunk ya está aislado, pero bloquea el TTI de esas rutas. Charts en tabs ocultos o debajo del fold cargan sin necesidad.

**libphonenumber-js/min (~118 KB / ~30 KB gzip)**: lo arrastra `src/lib/formatters/phone.ts`. Sólo lo usan **3 archivos reales**:

- `src/pages/proveedores/ProveedorDetalle.tsx`
- `src/components/cliente/detalle/ClienteInformacionCard.tsx`
- `src/pages/clientes/Clientes.tsx` (columna de tabla)

El resto importa otros formatters del barrel `@/lib/formatters`; con `sideEffects: false` debería tree-shakearse, pero conviene aislarlo en chunk propio para garantizarlo y permitir caching cross-route.

### Cambios

**1. Lazy de componentes de chart (7 archivos)**

Convertir cada uno de estos imports estáticos en `React.lazy` con `<Suspense>` y un skeleton del mismo alto:

| Página/contenedor | Componente a lazy-cargar |
|---|---|
| `pages/dashboard/Reportes.tsx` | `ReportesTopChart` |
| `pages/dashboard/Operaciones.tsx` | el bloque `recharts` interno → extraer a `OperacionesChart.tsx` y `lazy()` |
| `pages/admin/AdminDashboard.tsx` | extraer el chart inline a `AdminDashboardChart.tsx` y `lazy()` |
| `components/auditoria/AuditoriaEjecutivoTab.tsx` | `AuditoriaTendenciaChart` |
| `components/admin/DiagnosticoHealthPanel.tsx` | `HealthTopErrorsChart` + `HealthTimelineChart` |
| `components/operaciones/DesempenoOperadores.tsx` | si es el componente raíz de un tab, hacer lazy desde el tab; si es siempre visible, dejar y sólo crear skeleton |

Skeleton estándar: `<div className="h-[300px] w-full rounded-md bg-muted/40 animate-pulse" />` (altura ajustada por chart para evitar CLS).

Resultado: `charts-vendor` se descarga **después** del primer paint de cada ruta, no antes. Mejora directa en TTI de Reportes/Operaciones/AdminDashboard.

**2. Aislar `libphonenumber-js` en chunk propio**

En `vite.config.ts` añadir regla:

```ts
if (/node_modules\/libphonenumber-js/.test(id)) {
  return "phone-vendor";
}
```

Sólo se descarga cuando una de las 3 rutas que renderizan `formatPhoneMx` se monta. Cacheable independientemente.

**3. Verificación**

- `bun run audit:tests` → 0 violaciones.
- `bun run test` → 709/709.
- Smoke manual: abrir Reportes y Operaciones, ver skeleton breve, luego chart real; AdminDashboard idem.
- Bundle: `ANALYZE=true bun run build` y comparar tamaños — esperar:
  - `index.js` igual (los charts ya estaban fuera).
  - `charts-vendor` se descarga **lazy** (verificable en Network tab: aparece sólo al renderizar chart).
  - Aparece nuevo `phone-vendor-*.js` (~30 KB gzip).

**4. Versionado y memoria**

- `APP_VERSION` → `11.43.0`.
- Entrada en `CHANGELOG.md` raíz.
- Sin cambios de memoria de proyecto.

### Fuera de alcance

- Tree-shake de `lucide-react` (sub-loop 5.5).
- LCP/imágenes + `vite-imagetools` (sub-loop 5.6).
- Medición Web Vitals antes/después con `browser--performance_profile` (sub-loop 5.7).

### Riesgos

- **CLS**: si el skeleton no respeta la altura final del chart, hay shift de layout. Mitigación: skeleton con altura fija idéntica (`ResponsiveContainer` usa `height={300}` en la mayoría de casos).
- **Tabs ocultos**: si el chart está en un tab no-default, lazy + Suspense funciona perfecto. Si el chart es el primer contenido visible, el usuario verá el skeleton ~150–300 ms.
