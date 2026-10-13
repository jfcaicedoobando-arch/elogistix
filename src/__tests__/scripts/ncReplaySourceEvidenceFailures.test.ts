// @vitest-environment node
import { expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  OLD_SNAPSHOT, PIN_UPDATE_SNAPSHOT, NC_PATH, RUNNER_PATH,
  snapshotProfile, sourcePaths, byteIdentity, collectSourceEvidence, verifyArchivePackage, readRegular,
  type ArchiveManifest,
} from '../../../scripts/ci/nc-publica-replay/source-evidence.mjs';
import { fixture, put, manifestChange } from './fixtures/ncReplaySourceEvidence';

it('fails closed on a missing NC archive even when the active YAML has correct bytes', context => {
  const folder = fixture(context, true);
  fs.unlinkSync(path.join(folder, snapshotProfile(OLD_SNAPSHOT).wrappers[0].archivePath));
  expect(() => collectSourceEvidence(folder, 'minimal', OLD_SNAPSHOT)).toThrow(/ENOENT/);
});
for (const mutation of ['same-length-byte', 'newline', 'BOM', 'comment', 'CRLF']) {
  it(`rejects byte identity drift from ${mutation}`, context => {
    const folder = fixture(context), file = snapshotProfile(OLD_SNAPSHOT).wrappers[0].archivePath;
    const bytes = fs.readFileSync(path.join(folder, file));
    let changed = Buffer.from(bytes);
    if (mutation === 'same-length-byte') changed[0] ^= 1;
    if (mutation === 'newline') changed = Buffer.concat([bytes, Buffer.from('\n')]);
    if (mutation === 'BOM') changed = Buffer.concat([Buffer.from([239, 187, 191]), bytes]);
    if (mutation === 'comment') changed = Buffer.concat([bytes, Buffer.from('# additional comment\n')]);
    if (mutation === 'CRLF') changed = Buffer.from(bytes.toString().replaceAll('\n', '\r\n'));
    put(folder, file, changed);
    expect(() => collectSourceEvidence(folder, 'minimal', OLD_SNAPSHOT)).toThrow(/identity mismatch/);
  });
}
for (const snapshot of [OLD_SNAPSHOT, PIN_UPDATE_SNAPSHOT]) {
  for (const index of [0, 1]) {
    it(`rejects forged wrapper and manifest ${index} for ${snapshot}`, context => {
      const folder = fixture(context), anchor = snapshotProfile(snapshot).wrappers[index];
      const changed = Buffer.concat([fs.readFileSync(path.join(folder, anchor.archivePath)), Buffer.from('# forged\n')]);
      put(folder, anchor.archivePath, changed);
      manifestChange(folder, snapshot, m => Object.assign(m.wrappers[index], byteIdentity(changed)));
      expect(() => verifyArchivePackage(folder, snapshot)).toThrow(/independently pinned/);
      expect(() => collectSourceEvidence(folder, 'minimal', snapshot)).toThrow(/independently pinned/);
    });
  }
  it(`rejects substitution of the other snapshot under ${snapshot}`, context => {
    const folder = fixture(context), profile = snapshotProfile(snapshot);
    const other = snapshotProfile(snapshot === OLD_SNAPSHOT ? PIN_UPDATE_SNAPSHOT : OLD_SNAPSHOT);
    const bytes = fs.readFileSync(path.join(folder, other.wrappers[0].archivePath));
    expect(bytes.length).toBe(profile.wrappers[0].bytes);
    put(folder, profile.wrappers[0].archivePath, bytes);
    expect(() => collectSourceEvidence(folder, 'minimal', snapshot)).toThrow(/identity mismatch/);
    manifestChange(folder, snapshot, m => Object.assign(m.wrappers[0], byteIdentity(bytes)));
    expect(() => collectSourceEvidence(folder, 'minimal', snapshot)).toThrow(/independently pinned/);
  });
}
for (const kind of ['missing', 'directory']) {
  for (const relative of sourcePaths('full', OLD_SNAPSHOT).filter(p => p !== NC_PATH)) {
    it(`rejects ${kind} current input ${relative}`, context => {
      const folder = fixture(context);
      fs.unlinkSync(path.join(folder, relative));
      if (kind === 'directory') fs.mkdirSync(path.join(folder, relative));
      expect(() => collectSourceEvidence(folder, 'full', OLD_SNAPSHOT)).toThrow();
    });
  }
}
for (const relative of [snapshotProfile(OLD_SNAPSHOT).manifestPath,
  snapshotProfile(OLD_SNAPSHOT).wrappers[0].archivePath, RUNNER_PATH, 'docs/ci/workflow-archive', 'scripts/ci', 'scripts']) {
  it(`rejects symlink ${relative} before following its target`, context => {
    const folder = fixture(context), original = path.join(folder, relative), target = original + '.original';
    fs.renameSync(original, target); fs.symlinkSync(target, original);
    const opens: string[] = [], originalOpen = fs.openSync;
    const spy = vi.spyOn(fs, 'openSync').mockImplementation((name, flags, mode) => {
      opens.push(String(name)); return originalOpen(name, flags, mode);
    });
    try { expect(() => collectSourceEvidence(folder, 'full', OLD_SNAPSHOT)).toThrow(/Symlink/); }
    finally { spy.mockRestore(); }
    expect(opens.filter(name => [original, target].some(prefix => name === prefix || name.startsWith(prefix + '/')))).toEqual([]);
  });
}
it('rejects symlink checkout root and ancestors', context => {
  const folder = fixture(context), alias = folder + '-alias';
  fs.symlinkSync(folder, alias);
  context.onTestFinished(() => fs.unlinkSync(alias));
  expect(() => collectSourceEvidence(alias, 'full', OLD_SNAPSHOT)).toThrow(/root directory/);
  expect(() => readRegular(path.join(alias, 'scripts'), 'ci/nc-publica-replay/run.mjs')).toThrow(/root directory/);
});
for (const bad of ['/tmp/escape.yml', '../escape.yml', 'docs/../escape.yml', './relative.yml', 'bad\\path.yml', '', 'other.yml']) {
  it(`rejects archive redirection ${JSON.stringify(bad)}`, context => {
    const folder = fixture(context);
    manifestChange(folder, OLD_SNAPSHOT, m => { m.wrappers[0].archivePath = bad; });
    expect(() => collectSourceEvidence(folder, 'minimal', OLD_SNAPSHOT)).toThrow(/independently pinned/);
  });
}
const malformed: Record<string, (m: ArchiveManifest) => void> = {
  format: m => { m.format = 2; }, repository: m => { m.repository = 'other/repo'; },
  snapshot: m => { m.observedAtCommit = PIN_UPDATE_SNAPSHOT; },
  missingEntry: m => { m.wrappers.pop(); }, emptyEntries: m => { m.wrappers = []; },
  extraEntry: m => { m.wrappers.push(structuredClone(m.wrappers[0])); },
  duplicateEntry: m => { m.wrappers[1] = structuredClone(m.wrappers[0]); },
  unknownWrapper: m => { m.wrappers[0].originalPath = '.github/workflows/other.yml'; },
  manifestField: m => { Object.assign(m, { fallback: '.github/workflows' }); },
  entryField: m => { Object.assign(m.wrappers[0], { fallback: true }); },
  missingField: m => { Reflect.deleteProperty(m.wrappers[0], 'gitBlobSha1'); },
  sizeType: m => { Object.assign(m.wrappers[0], { bytes: String(m.wrappers[0].bytes) }); },
};
for (const [name, change] of Object.entries(malformed)) {
  it(`rejects malformed manifest ${name}`, context => {
    const folder = fixture(context); manifestChange(folder, OLD_SNAPSHOT, change);
    expect(() => collectSourceEvidence(folder, 'minimal', OLD_SNAPSHOT)).toThrow();
  });
}
it('rejects invalid JSON and a non-object manifest', context => {
  const folder = fixture(context);
  for (const value of ['{', 'null', '[]']) {
    put(folder, snapshotProfile(OLD_SNAPSHOT).manifestPath, value);
    expect(() => collectSourceEvidence(folder, 'minimal', OLD_SNAPSHOT)).toThrow();
  }
});
for (const bad of [undefined, null, '', 'FULL', 'legacy']) {
  it(`requires a valid explicit mode instead of ${String(bad)}`, context => {
    expect(() => collectSourceEvidence(fixture(context), bad, OLD_SNAPSHOT)).toThrow(/Unsupported replay mode/);
  });
}
for (const bad of [undefined, null, '', 'main', '43a4536', 'b'.repeat(40), '__proto__']) {
  it(`requires a full explicit known snapshot instead of ${String(bad)}`, context => {
    expect(() => collectSourceEvidence(fixture(context), 'minimal', bad)).toThrow(/Explicit known/);
  });
}
it('propagates an unreadable source without returning partial evidence', context => {
  const folder = fixture(context), originalOpen = fs.openSync;
  const spy = vi.spyOn(fs, 'openSync').mockImplementation((name, flags, mode) => {
    if (name === path.join(folder, RUNNER_PATH)) throw Object.assign(new Error('Fixture denied'), { code: 'EACCES' });
    return originalOpen(name, flags, mode);
  });
  try { expect(() => collectSourceEvidence(folder, 'minimal', OLD_SNAPSHOT)).toThrow(/Fixture denied/); }
  finally { spy.mockRestore(); }
});
it('rejects unsafe relative paths and relative roots', context => {
  const folder = fixture(context);
  for (const relative of ['/tmp/file', '../file', 'a/../b', './a', 'a//b', 'a\\b', 'a\0b', '']) {
    expect(() => readRegular(folder, relative)).toThrow(/Unsafe source path/);
  }
  expect(() => readRegular('.', RUNNER_PATH)).toThrow(/Absolute checkout root/);
});
