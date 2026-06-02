REVOKE ALL ON public._backup_merge_embarques_20260602 FROM anon, authenticated;
REVOKE ALL ON public._backup_merge_fk_remap_20260602 FROM anon, authenticated;
GRANT ALL ON public._backup_merge_embarques_20260602 TO service_role;
GRANT ALL ON public._backup_merge_fk_remap_20260602 TO service_role;
ALTER TABLE public._backup_merge_embarques_20260602 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_merge_fk_remap_20260602 ENABLE ROW LEVEL SECURITY;