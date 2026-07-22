
CREATE UNIQUE INDEX IF NOT EXISTS uq_embarques_bl_house_org
  ON embarques (organization_id, upper(bl_house))
  WHERE bl_house IS NOT NULL
    AND bl_house <> ''
    AND organization_id <> '00000000-0000-0000-0000-000000000001'::uuid;
