
The user is asking for a re-audit after Phases 1-3 (v8.15.0 → v8.15.2) have been completed. I should reflect what's been resolved and what remains, plus surface anything new. Read-only analysis — no code changes.

Items already resolved in previous phases:
- #3 Mappings unified → ESTADO_CONFIG ✅
- #2 Business logic extraction (partial: embarqueMappers, costosUSD, cotizacionFormMappers) ✅
- #1 Component decomposition (partial: useEmbarqueDetalleTracking) ✅

Still pending from previous audit: #4 god hooks, #5 constants vs types, #6 lib reorg, #7 direct supabase in components, #8 prop-drilling wizards, #9 feature folders, #10 tests, #11 naming, #12 edge function shared, #13 design tokens for states, #14 barrel exports.

I'll present a fresh, concise audit reflecting current state.
