
## Diagnóstico: los 3 números miden cosas distintas (y uno está mal etiquetado)

El flujo correcto del negocio es:

```text
Embarque cerrado
   └─▶ Proforma (estado_revision = 'pendiente')   ← esperando aprobación INTERNA
         └─▶ Proforma aprobada (estado_revision = 'aprobada', factura_id IS NULL)
               └─▶ Factura Borrador (sin uuid_fiscal)
                     └─▶ CFDI timbrado
                           └─▶ Pago  →  REP (si es PPD)
```

Consulté la base y los 3 números que ves en `/facturacion` vienen de **puntos distintos** del embudo:

| Número que ves     | De dónde sale                                                                 | Qué mide realmente                                                       |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **9** (en /proformas) | `proformas` con `estado_revision='aprobada'` y `factura_id IS NULL` filtrado por tu org | Proformas listas para convertir a factura                                |
| **29** (KPI dashboard) | `useProformasPendientes()` → `estado_revision='pendiente'`                    | Proformas **pendientes de revisión interna** (¡NO aprobadas!)            |
| **43** (tab "Por facturar") | `useHuecoFacturacion` → embarques con ETD > hace 5 días y sin CFDI por expediente | Embarques cerrados que **no tienen factura** (haya proforma o no)         |

### El bug de fondo

En `DashboardEjecutivoFacturacion.tsx` línea 110-140:

- La variable se llama `porTimbrar` pero se llena con `proformasPendientes.length` (que son `estado_revision='pendiente'`).
- El label dice **"Proformas por facturar"** y el tooltip afirma _"aprobadas por el cliente que aún no se han convertido en factura"_.
- Pero el query es de proformas **pendientes de revisión interna**, no aprobadas.

Por eso ves 29 cuando en `/proformas` sólo hay 9 aprobadas.

Además, la tab "Por facturar" no muestra proformas: muestra el **hueco** (embarques sin CFDI), que es una métrica de vigilancia distinta y perfectamente válida — pero mezclada con las otras confunde.

---

## Plan de arreglo (sólo UI y un hook nuevo, sin tocar datos)

### 1. Renombrar el KPI mal etiquetado

En `DashboardEjecutivoFacturacion.tsx`:
- Cambiar el label **"Proformas por facturar"** → **"Proformas por revisar"**.
- Ajustar el tooltip para que diga la verdad: _"Proformas generadas desde embarques que aún no han sido revisadas/aprobadas internamente. Una vez aprobadas pasan a 'Listas para facturar'."_
- Mantener la tonalidad `warn` cuando > 0.

### 2. Agregar un KPI faltante: "Listas para facturar"

Nuevo hook `useProformasAprobadasSinFactura(orgId)` que hace:

```sql
select count(*) from proformas
where organization_id = :org
  and estado_revision = 'aprobada'
  and factura_id is null
```

(usar `count: 'exact', head: true`, sin traer filas).

Pintarlo como sexto KPI en el dashboard, tono `warn` cuando > 0, con tooltip _"Proformas aprobadas listas para convertir en factura (CFDI)"_. Este es el número que debería cuadrar con los **9** que ves en `/proformas`.

### 3. Renombrar la bandeja "Por facturar" para que quede claro qué mide

En `BandejaTabs.tsx` renombrar la pestaña **"Por facturar"** → **"Embarques sin factura"** (o **"Hueco de facturación"**). Es lo que ya muestra internamente (`BandejaPorFacturar` reusa `useHuecoFacturacion`). Con el nombre correcto deja de confundirse con el KPI de proformas.

Su badge de conteo sigue viniendo de `useHuecoFacturacion` (los 43).

### 4. Añadir una bandeja "Proformas listas" al lado

Nueva pestaña **"Proformas listas"** al inicio de `BandejaTabs`, que muestre la lista real (`estado_revision='aprobada'` + `factura_id IS NULL`) con:
- Columnas: Nº proforma · Cliente · Embarque · Total · Moneda · Fecha
- Acción rápida por fila: **"Convertir a factura"** (abrir `ConvertirAFacturaDialog` ya existente — no hay que crearlo).
- Badge de conteo = mismo número del KPI nuevo (los 9 en tu caso).

Con eso, el flujo queda visible en la fila de tabs en el orden real del negocio:

```text
[Embarques sin factura]  [Proformas listas]  [Por timbrar]  [Por enviar]
        (43)                   (9)              (…)            (…)
   ↓                        ↓
   embarques cerrados       proformas aprobadas
   que faltan proforma      esperando conversión
   o factura                a CFDI
```

### 5. Documentación y versión

- Actualizar `docs/flujo-facturacion.md`: añadir la sección "¿Qué mide cada bandeja/KPI?" con la tabla de arriba.
- Bump `APP_VERSION` → `13.213.0` y entry en `CHANGELOG.md`.

---

## Detalles técnicos

**Archivos a crear**
- `src/features/facturacion/services/proformasListas.ts` — fetch de proformas aprobadas sin factura (lista + conteo).
- `src/features/facturacion/hooks/useProformasListas.ts` — react-query wrapper (staleTime 60s).
- `src/features/facturacion/components/bandejas/BandejaProformasListas.tsx` — tabla con acción "Convertir a factura".

**Archivos a editar**
- `src/features/facturacion/components/DashboardEjecutivoFacturacion.tsx` — renombrar KPI y añadir "Listas para facturar".
- `src/features/facturacion/components/bandejas/BandejaTabs.tsx` — renombrar tab existente y añadir la nueva pestaña.
- `src/features/facturacion/routes/Facturacion.tsx` — enrutar el nuevo `?bandeja=proformas-listas`.
- `src/features/facturacion/services/bandejas.ts` — sumar `proformasListas` a `BandejaConteos`.
- `docs/flujo-facturacion.md`, `CHANGELOG.md`, `src/constants/appVersion.ts`.

**Fuera de alcance**
- No se toca `useProformasPendientes` (se sigue usando en `/proformas` para el listado de pendientes).
- No se cambia lógica de conversión, timbrado, envío, ni RLS.
- No hay migración de base de datos.

## Analogía (para que quede claro)

Imagina una panadería:

- **Hueco (43)** = pedidos que ya se entregaron y todavía no le hemos pasado la cuenta al cliente.
- **Pendientes de revisión (29 → "Por revisar")** = notas de cuenta que el vendedor escribió pero el gerente aún no las firma.
- **Listas para facturar (9 → nuevo KPI)** = notas ya firmadas por el gerente, esperando a que caja emita la factura oficial (CFDI).

Hoy el dashboard te enseña la "pila del gerente" (29) con el nombre "listas para facturar", y por eso no cuadra con nada. El plan pone cada pila con su nombre correcto.
