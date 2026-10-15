// @vitest-environment node
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDrizzleReplay } from '../../lib/audit-drizzle-replay';
import { scanSecurityDefinerWithPreservedAcl } from '../../lib/audit-acl-preservation';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const file='0021_crm_helpers_owner_only.sql';
const mirror='20261015194324_crm_helpers_owner_only.sql';
const sql=readFileSync(resolve(root,'drizzle/migrations',file),'utf8');
const replay=readFileSync(resolve(root,'supabase/migrations',mirror),'utf8');
const entries=JSON.parse(readFileSync(resolve(root,'drizzle/replay.json'),'utf8')).filter((x:{file:string})=>x.file===file);
test('canonical replay passes existing exact source mapping guard',()=>expect(scanDrizzleReplay(new Map([[file,sql]]),new Map([[mirror,replay]]),entries)).toEqual([]));
test('changed canonical bytes fail existing mapping guard',()=>expect(scanDrizzleReplay(new Map([[file,sql+'\n']]),new Map([[mirror,replay]]),entries).length).toBeGreaterThan(0));
test('no SECURITY DEFINER exemption needed',()=>expect(scanSecurityDefinerWithPreservedAcl(mirror,replay,true)).toEqual([]));
