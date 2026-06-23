# Refrescar el Centro de Ayuda (`/ayuda`)

## Diagnóstico de lo que hay hoy
`src/features/dashboard/routes/ayudaContent.ts` (89 líneas) contiene:
- **16 términos** en el glosario (logística/finanzas básicos).
- **4 módulos** de FAQ: Embarques, Facturación, Clientes, Operación diaria — con 4–5 preguntas cada uno.

**Está desactualizado.** No menciona nada de: CRM, Costeo / Tarifas, Compras (CXP), Tesorería, Profit, Auditoría, Bandejas, Portal de Cliente, roles modernos, garantías y demoras, handoff vendedor↔coordinador, ni atajos del CRM. Un usuario nuevo que abre `/ayuda` se queda con la impresión de que el ERP es sólo Embarques + Facturas.

## Analogía
Hoy el manual del coche habla del volante, los pedales y las luces. Pero el coche ya tiene GPS, sensores de estacionamiento, cámara trasera, Apple CarPlay y modo eco — y el manual ni los menciona. Vamos a reescribirlo para que cubra TODO lo que el conductor (usuario final) realmente tiene en el tablero.

---

## 1) Glosario — expandir de 16 → ~35 términos

Mantener los actuales (siguen vigentes) y agregar:

**Logística operativa nueva**
- Carta garantía · Días libres almacenaje · Demoras escalonadas (tabulador)
- Free time · Detention vs Demurrage · UN/LOCODE
- Handoff (cotización confirmada → embarque)

**Comercial / CRM**
- Lead · Oportunidad · Actividad · Pipeline ponderado
- Next Best Action (NBA) · Forecast · Embudo · Leaderboard
- KAM (Key Account Manager)

**Pricing y costeo**
- Tarifa vigente · Override de tarifa · Top 3 ranking · Partner / Agente
- P&L preliminar · Margen bruto · Tarifa-first (política)

**Finanzas y compras**
- CXP / CXC · Folio interno proveedor (FP-XXXXXX) · "Por capturar" · "Por pagar"
- Conciliación bancaria · CFDI 4.0 · Complemento de pago (REP)
- Estado de resultados · Aging (ya está, dejar) · Diferencia cambiaria

**Plataforma**
- Tenant / Organización · Impersonación · Bitácora · Bandeja · RLS

---

## 2) Módulos / FAQ — pasar de 4 → 10 módulos

Cada módulo: 4–6 preguntas escritas **en pies del usuario final** ("¿cómo hago X?", "¿por qué no puedo Y?", "¿qué pasa si Z?"), con respuestas concretas que mencionen la ruta del menú y los botones reales.

| # | Módulo | Audiencia principal | Foco de las FAQ |
|---|---|---|---|
| 1 | **Inicio / Dashboard** | Todos | Qué muestra cada card, qué significa cada badge, cómo cambiar de scope (mío / todos) |
| 2 | **CRM** | Vendedor, Gerente Comercial | Diferencia *Mi día* vs *Resumen*, cómo crear lead, convertir a oportunidad, NBA, atajos (Quick Add, Ctrl+K del CRM), forecast |
| 3 | **Cotizaciones** | Vendedor, Pricing | Wizard tarifa-first, cuándo cargar costos vs venta, P&L preliminar, override de tarifa (quién lo aprueba), handoff a embarque |
| 4 | **Costeo / Tarifas** | Pricing | Matriz CN→MX, ranking Top 3, capturar tarifa con días libres + frecuencia, vincular partner↔proveedor, carta garantía, tabulador demoras |
| 5 | **Embarques** | Coordinador, Operador | (Mantener las 5 FAQ actuales + agregar) tracking automático desde timeline, garantías/demoras auto-calculadas, alerta de docs faltantes, candado de avance de estado, cerrar embarque |
| 6 | **Compras (CXP)** | Auxiliar contable, Tesorero | Bandeja "Por capturar", subir XML/PDF de proveedor, folio interno FP-XXXXXX, conciliar contra costos del embarque, "Por pagar", quién autoriza pagos |
| 7 | **Facturación (CXC)** | Contador, Cobranza | (Refrescar las 5 actuales) proformas, consolidación, layout contable, hueco de facturación, cancelar CFDI, complemento de pago REP, cartera y promesas de pago |
| 8 | **Tesorería** | Tesorero | Conciliación bancaria, sugerencias automáticas (tolerancia ±$1 / ±5 días), liquidar comisiones, separación de divisas |
| 9 | **Profit / Reportes** | Gerencia, Contador | P&L por contenedor, estado de resultados con diferencia cambiaria, exportar a contabilidad, leaderboard vendedores |
| 10 | **Clientes y Portal** | Atención a clientes, Coordinador | (Mantener las 4 actuales + agregar) parseo CSF con IA, contactos internacionales, qué ve el cliente en el portal, notificaciones |
| 11 | **Operación diaria** | Todos | (Refrescar las 4 actuales + agregar) Ctrl+K global, badges del sidebar, bandejas (qué son), bitácora, cambiar de organización (impersonación super-admin), modo demo |
| 12 | **Roles y permisos** | Admin de organización | Lista de 12 roles agrupados (Admin / Ops / Comercial / Finanzas / Soporte), cómo asignar, qué puede ver/hacer cada uno, handoff vendedor→coordinador, quién aprueba overrides |

> Total esperado: ~55 FAQs (vs 18 actuales). Estilo: español MX claro, respuestas de 1–3 frases, **siempre** mencionando la ruta exacta del menú o la pestaña.

---

## 3) Cambios estructurales menores en `Ayuda.tsx`

El componente actual funciona bien pero con 12 módulos la lista vertical de tarjetas se vuelve larga. Cambios mínimos:

- **Mantener** el search, los dos tabs (FAQ / Glosario), el accordion por módulo.
- **Agregar** un índice/chips al inicio del tab FAQ con los nombres de los 12 módulos como anclas (`<a href="#cotizaciones">Cotizaciones</a>` con `scroll-margin-top` para que el sticky nav no tape). Cada Card de módulo recibe `id={modulo.id}`. Esto evita scrollear ciegamente.
- **Agregar atributos `audiencia: AppRole[]`** opcional a cada módulo (por ejemplo CXP → contador, auxiliar_contable, tesorero) — **no se filtra automáticamente** por rol en esta iteración (mantener simple), pero se renderiza como badge pequeño en el header del módulo: `"Para: Contador · Tesorero"`. Ayuda al usuario a saber si esa sección le aplica.
- **Conservar** el fallback "¿No encuentras lo que buscas?" al final, actualizar el texto: en vez de pedir contactar al admin, mencionar el CHANGELOG y el módulo de Auditoría para reportar incidencias.

`Ayuda.tsx` quedará ~170 líneas (sigue bajo el límite de 200).

---

## 4) Archivos a editar

- `src/features/dashboard/routes/ayudaContent.ts` — reescritura completa del contenido (glosario + módulos). Pasa de ~89 líneas a ~350 (es contenido estático, no lógica — el límite de 200 líneas del Power of 10 aplica a componentes/módulos de lógica, no a archivos de constantes; igual lo mantenemos legible).
  - Extender el tipo `AyudaModulo` con `audiencia?: string[]` (lectura humana, no enum estricto, para evitar acoplamiento con `AppRole`).
- `src/features/dashboard/routes/Ayuda.tsx`:
  - Renderizar chips de índice al inicio del tab FAQ.
  - Pasar `id={modulo.id}` y `scroll-mt-20` al `<Card>` de cada módulo.
  - Renderizar la audiencia como `<Badge variant="outline" className="text-[10px]">` al lado del título.
  - Actualizar copy del fallback final.

**Sin cambios** en rutas, sidebar, BD, hooks, ni en otros tests.

---

## 5) Versionado y registro

- Bump `APP_VERSION` → `13.118.1` en `src/constants/appVersion.ts` (patch — sólo contenido y polish).
- Entrada en `CHANGELOG.md`: "Centro de ayuda: glosario expandido (16→~35), 12 módulos de FAQ alineados a los roles modernos del ERP, índice clickeable y audiencia visible por módulo."

## 6) Pruebas

No se agregan tests nuevos (contenido y presentación). Si existen snapshots de `Ayuda.tsx` o tests que cuentan `MODULOS.length === 4`, se ajustan al actualizar. (Revisión rápida en build: `rg "MODULOS|GLOSARIO" src --files-with-matches` muestra que sólo `Ayuda.tsx` los consume — sin tests dependientes.)
