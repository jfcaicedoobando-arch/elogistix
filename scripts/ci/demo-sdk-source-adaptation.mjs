/** One reviewed import migration; historical source inventories remain unchanged. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const adapter = 'supabase/functions/demo-access/index.ts';
const previous = 'import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";';
const current = 'import { createClient } from "npm:@supabase/supabase-js@2.119.0";';

export function historicalDemoSourceBytes(path, bytes) {
  if (path !== adapter) return bytes;
  // Pin the complete migrated adapter before reversing its sole reviewed change.
  // A body/wiring change, another SDK version or an old adapter cannot pass.
  assert.equal(bytes.length, 1103, adapter);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    'ecb122453a3ed2726d4b0133ece8924457bec5413a056fa5cee52b7d8237d998', adapter);
  const source = bytes.toString('utf8');
  assert.equal(source.split(current).length - 1, 1, 'Exact migrated SDK import required');
  assert.equal(source.includes(previous), false, 'Historical SDK import must be absent');
  return Buffer.from(source.replace(current, previous), 'utf8');
}
