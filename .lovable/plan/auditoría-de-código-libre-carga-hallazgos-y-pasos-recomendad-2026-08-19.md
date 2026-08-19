# Auditoría de código Libre Carga — hallazgos y pasos recomendados

Auditoría de solo lectura sobre 3,992 archivos en `src`. Todo lo que sigue está verificado con búsquedas reales, no supuesto.

## Estado general: bueno

Antes de la lista de problemas, lo que ya está sano y no hay que tocar:

- Ningún componente `.tsx` habla directo con la base de datos (0 casos fuera de mocks de prueba).
- Ningún cálculo fiscal (IVA, retenciones, T/C) vive dentro de un componente: todos usan `src/lib/financial/*`.
- Ningún archivo de `services/` importa React ni componentes (capas sin invertir).
- Ningún archivo productivo pasa de 200 líneas; `any` = 0; código comentado abandonado = 0.
- Código muerto: `knip` reporta solo 2 tipos exportados sin uso.

El problema real ya no es "código sucio", es **fronteras entre módulos** y **reglas repetidas**.

---

## Pasos recomendados, de más crítico a opcional

### 1. CRÍTICO — Un solo cálculo de "días vencidos / días de demora"
La fórmula cruda `(a - b) / (1000*60*60*24)` está reescrita en 9 archivos de producción, y cada uno redondea distinto (`floor`, `round`, `ceil`): `TabPortalCliente.tsx:27`, `garantiasUtils.ts:5`, `cobranza.ts:104`, `huecoFacturacion/buildFilas.ts:28`, `mappers/cotizacion.ts:65`, `AgenteInicio.tsx:34`, `navieraCondicion.ts:66`, `estadoVigenciaCell.tsx:18`, `estadoCuentaTypes.ts:114`.
Riesgo: la misma factura puede aparecer con 30 o 31 días vencidos según la pantalla, y el horario de verano mueve el resultado un día. Esto se cobra al cliente (demoras).
Arreglo: exponer `diffDiasCalendario` en `src/lib/date/dateOnly.ts` (que ya documenta el problema de DST) y migrar los 9 sitios, más un test por sitio.
Qué puede romperse: valores mostrados que hoy son incorrectos cambiarán en un día; hay que revisar los tests de cartera y demoras.

### 2. CRÍTICO — Dependencia circular entre `dashboardEjecutivo` y `profit`
`dashboardEjecutivo` importa servicios y hooks de `profit` (`agregador.ts:6-20`, `useDashboardEjecutivo.ts:7`) y `profit/routes/ProfitDashboardEjecutivo.tsx:12-20` importa 9 componentes de `dashboardEjecutivo`.
Riesgo: ciclo de dependencias; cualquier cambio en uno rompe el otro y los tiempos de build/HMR se degradan.
Arreglo: fusionar ambos en un solo feature (`profit`, con el dashboard como carpeta interna) o dejar el cálculo del EERR en `profit` y las vistas en `dashboardEjecutivo`, en una sola dirección.
Qué puede romperse: rutas de importación en ~15 archivos y el guardrail de arquitectura.

### 3. ALTO — Barriles públicos por feature (243 imports profundos)
Solo 4 de 36 features exponen `index.ts` (`configuracion`, `cxp`, `proformas`, `tesoreria`). El resto se consume entrando a sus carpetas internas: 243 imports cruzados. Peores: `embarques→catalogos` (13), `portal-agente→costeo` (9), `proveedor→expediente` (8), `cotizacion→costeo` (8).
Riesgo: mover un archivo dentro de un feature rompe silenciosamente a otros 5-10 features; no existe contrato público.
Arreglo por olas (los 6 features más consumidos primero: `embarques`, `facturacion`, `cotizacion`, `crm`, `catalogos`, `admin`), extendiendo el test `feature-barrel-surface.test.ts` ya existente.
Qué puede romperse: nada en runtime; es renombrado masivo de imports, verificable con typecheck.

### 4. ALTO — `index.ts` que en realidad es un servicio con lógica
`catalogos/services/index.ts` (159 líneas) hace `supabase.from(...)`, define tipos y CRUD. Igual en `configuracion` (136), `auth` (95), `reportes` (95), `operaciones`, y `costeo/types/index.ts` (127), `auditoria/types/index.ts` (125).
Riesgo: importar "el índice" para un tipo arrastra código de red; nadie sabe si un import es barato o caro.
Arreglo: mover la lógica a archivos con nombre (`navieras.ts`, `puertos.ts`) y dejar `index.ts` solo re-exportando.

### 5. ALTO — Tipo `Moneda` redeclarado en más de 15 archivos
Ya existe el alias central `src/types/db.ts:20` (`Moneda = Enums<"moneda">`), pero siguen apareciendo uniones locales `"MXN" | "USD" | "EUR"` en `cxp/services/{anticipos,cxpAging,pagoProveedorMovimiento}.ts`, `compras/services/*`, `crm/services/*`, `anticipos-proveedor/*`, `tesoreria/services/sugerirCandidatos.ts`, `lib/financial/financialUtils.ts`, entre otros. Peor: `cxpAging.ts:9` usa `... | string`, que anula la validación de tipos.
Riesgo: al agregar una moneda hay que tocar 15+ archivos y alguno queda desincronizado sin que el compilador avise.
Arreglo: importar `Moneda` de `@/types/db` en todos y borrar las uniones locales, con guardrail que prohíba la unión literal.

### 6. ALTO — Buckets de antigüedad (aging) definidos dos veces
`reportes/cartera/domain/agingCartera.ts:21-23` y `proveedor/domain/movimientosProveedor.ts:41` definen los mismos rangos 0-30 / 31-60 / +60 para clientes y proveedores por separado.
Riesgo: si dirección cambia el criterio, un reporte queda con los rangos viejos.
Arreglo: un solo catálogo de rangos en `src/constants` y etiqueta parametrizada.

### 7. ALTO — Topes de consulta (`.limit`) como números mágicos en 40+ archivos
`.limit(500)`, `.limit(1000)`, `.limit(2000)` repartidos por `services/`, con el motivo escrito como comentario suelto en cada archivo (el cap silencioso de 1000 de PostgREST).
Riesgo: una tabla que crece corta datos sin avisar y el reporte sale incompleto; nadie sabe cuál es el tope correcto.
Arreglo: constantes con nombre (`CAP_DEFENSIVO_POSTGREST`, `CAP_CATALOGO`, `CAP_REPORTE`) y usar el aviso de truncamiento existente (`warnIfTruncated`) donde falte.

### 8. MEDIO — Tres componentes de un solo dueño viviendo en `components/shared`
`PortalFilterSheet.tsx` y `PortalFiltersBar.tsx` los usa únicamente `portal`; `ProfitBadge.tsx` únicamente `cotizacion` (7 sitios).
Riesgo: "shared" se convierte en cajón de sastre y se pierde de vista quién es el dueño.
Arreglo: moverlos dentro de su feature.

### 9. MEDIO — Despachos lineales largos y ternarios triples
16 ramas `if` en `bitacoraDescripcionModulos.ts:16-41` (con `eslint-disable complexity`), 23 en `bitacoraDescripcion.ts`, y estructura duplicada `fmtCxc`/`fmtCxp` en `cierreCheckFormatters.ts:43-85`. Ternarios de 3 niveles en `calculosCartera.ts:33`, `inteligenciaProveedor.ts:101`, `ProveedorScorecardCards.tsx:89`.
Riesgo: un arreglo hay que aplicarlo dos veces y es fácil olvidar una rama.
Arreglo: tablas `Record<accion, fn>` y una función `clasificarBucket(valor)` con rangos.

### 10. OPCIONAL — Nombres inconsistentes
Features raíz mezclan estilos: `dashboardEjecutivo` (camelCase), `anticipos-proveedor` / `portal-agente` (kebab-case), el resto plano. Igual en subcarpetas (`facturacion/estadoCuenta`, `shared/dataTable`, `shared/errorBoundary`). Y `_helpers.ts` existe en 3 lugares con contenido no relacionado.
Riesgo: bajo; solo fricción al buscar.
Arreglo: elegir kebab-case y renombrar en una sola ola (se resuelve mejor junto con el paso 3), documentando la convención de `_sections/` en un README.

### 11. OPCIONAL — Limpieza menor
Los 2 tipos exportados sin uso que reporta `knip` (`CotizacionDetalleTotales`, `CotizacionDetalleDialogos`) y 33 marcas `TODO/FIXME` sin dueño: revisar y cerrar o convertir en tarea.

---

## Notas técnicas

- Medición: `wc -l` sobre productivos (máximo 199 líneas), `rg` para imports cruzados, `knip` para exports muertos, revisión manual de los archivos con más ramas.
- Cada paso puede entregarse como una ola independiente con su guardrail en `src/__tests__/architecture/`, siguiendo el patrón ya usado (`select-star-ratchet`, `props-drilling-cap`).
- Orden sugerido de ejecución: 1 → 2 → 5 → 6 → 7 → 4 → 3 → 8 → 9 → 10 → 11. Los pasos 1, 5, 6 y 7 tocan dinero y datos; el 3 es el más grande en volumen de archivos y conviene después de estabilizar lo financiero.
- Esta auditoría no modificó ningún archivo de la aplicación.
