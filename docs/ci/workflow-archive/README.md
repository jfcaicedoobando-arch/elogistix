# Frozen workflow observations: preparation only

Both workflows remain active in `.github/workflows/`. This package prepares
historical byte verification; it does not retire a workflow, change an event,
permission or required check, or run any SQL. The active NC runner still emits
`format: 1`, reads its active YAML, and does not import the prepared helper.

## Two explicit snapshots

The original [43a4536 observation](https://github.com/jfcaicedoobando-arch/elogistix/commit/43a453641a933e2f3f2be3fd766322307c8b9f3b)
uses [manifest.json](manifest.json) and the two adjacent `.yml.txt` files.
Those original bytes and anchors are immutable:

- NC: 5,055 bytes; blob `51bfc2d45d2983a387dd38d7ea8bbe23779f0cd5`;
  SHA256 `fcc833f760eaa9d3f530dbadc715b8228dcdcc873580d84401e4ca5ad1fa6228`.
- Acceptance: 2,865 bytes; blob `c308b572c2aff0afbb6acaa87a44161c758fc36f`;
  SHA256 `a61cda29d9b205a6753430e138ed6443335ece5d9bfad3e05f2cf93a22b5dbdb`.

The additional [2efa854 observation](https://github.com/jfcaicedoobando-arch/elogistix/commit/2efa854223d0b7e7b38cb4cf743fc48b9b86a052)
uses its [own manifest](2efa854223d0b7e7b38cb4cf743fc48b9b86a052/manifest.json)
and separate directory named with the full SHA:

- NC: 5,055 bytes; blob `44b0eb120c1d7188548b3e742f3bcb3a8ae6999a`;
  SHA256 `f8b28aa60913563b7db0742fd112632a49e7c7418eb37156bbd253b23d741f2a`.
- Acceptance: 2,865 bytes; blob `d23dbcc718ab136bcfe3bf6bfb748953f3c016bf`;
  SHA256 `28396c0f292020bc593d153b2e8cc106d85cc74a503e9e326502f833964238e9`.

At the preparation base [78d2427](https://github.com/jfcaicedoobando-arch/elogistix/commit/78d2427f0ca4ac07976bb1fa6a6fb6c1c9bd875b),
which merged [PR295](https://github.com/jfcaicedoobando-arch/elogistix/pull/295),
both active wrapper blobs were checked and match the second observation.
This is a statement about that exact base, not a floating-main assertion.
Neither observation certifies that a workflow executed or that a replay passed.
The related harnesses originated in [PR258](https://github.com/jfcaicedoobando-arch/elogistix/pull/258)
and [PR265](https://github.com/jfcaicedoobando-arch/elogistix/pull/265).

## Prepared API, not an active runner contract

`collectSourceEvidence(root, mode, snapshot)` requires an absolute caller root,
`minimal` or `full`, and one of the two exact full snapshot SHAs. There is no
branch alias, environment selector or fallback. It verifies the fixed manifest
against independent frozen anchors, then reads every permitted input once.
Missing/nonregular/symlink/unreadable inputs and modified archives fail closed.
Changing an archive and recalculating its manifest does not authorize new bytes.
The checkout must remain immutable during collection, as for the current runner.

The return value has `sources` and complete `sourceBindings`: the NC YAML keeps
its original logical key while its binding records the archived physical path
and `observedAtCommit`. All other keys use their current checkout paths. The
helper preserves the seven/thirteen legacy keys and adds itself and the chosen
manifest, producing nine/fifteen keys. It does not create a run, set a status,
validate SQL, read Git/events/environment, or assign `reviewCommit`.
`verifyArchivePackage` separately verifies both archived wrappers; Acceptance
is not an SQL input dependency of the NC collector.

The helper's import has no filesystem, subprocess, network or environment side
effects. Its `.d.mts` declaration exists for the existing TypeScript checks.
The archives/manifests live outside the NC staging roots. Minimal staging still
lists the same nine inputs. The unchanged full exporter would include the new
`.mjs` helper and modified harness README bytes, and record their actual hashes;
`.d.mts` is outside its extension allowlist. No full staging run is performed by
this preparation, and no `run.json`/`staging.json` artifact is rewritten.

Existing v1 artifacts retain their original meaning and files. A future switch
to archived resolution must explicitly change the NC record to v2 and adapt
known consumers; this package includes no new artifact reader and does not
claim compatibility for unknown external consumers. `reviewCommit` must remain
the admitted current checkout SHA, distinct from the archive observation SHA.

## Verification and remaining gates

Three suites in `src/__tests__/scripts/ncReplaySourceEvidence*.test.ts` run in the
existing Vitest normal/node lane. Their temporary runtime inputs are labeled
synthetic and never executed. No workflow, shard count, selector, catalog rule,
aggregator or audit baseline is added or relaxed. Run them using the existing
`bun run test -- src/__tests__/scripts/ncReplaySourceEvidence` command.

Keep both active wrappers until an authorized source confirms effective required
checks AND workflow rules, consumers have been inventoried/adapted at the final
SHA, and the exact implementation passes required CI. In particular the four
existing checks remain unchanged:

- Minimal SQL replay 24 x 2 and metadata
- Official full replay, generated baseline, guards and RLS
- Acceptance candidate PG17.9 (strict gate and baseline)
- Acceptance candidate PG17.6 (diagnostic)

Unknown or inaccessible protection settings still block retirement; do not infer
permission from merged PRs, skipped jobs or incomplete search results. Future
runner format changes and joint wrapper removal require a separate reviewed,
atomic change. Reverting this preparation removes only new archive/helper/tests
and its documentation additions; the original active runner/workflows persist.
