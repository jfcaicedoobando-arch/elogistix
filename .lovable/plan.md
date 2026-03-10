

## Fix: Revert COT-2026-0007 to 'Aceptada'

### Verified State
- **Folio**: COT-2026-0007 (id: `9ea07dbb-...`)
- **Current estado**: `Embarcada`
- **Linked embarques**: 0 (confirmed — the embarque was already deleted)

### Action
Execute a data UPDATE (not a migration) to set the estado back to `'Aceptada'`:

```sql
UPDATE public.cotizaciones
SET estado = 'Aceptada'
WHERE folio = 'COT-2026-0007'
  AND estado = 'Embarcada';
```

Single statement, no code changes needed.

