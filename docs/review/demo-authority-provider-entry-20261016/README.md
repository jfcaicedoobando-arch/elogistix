# Authority provider and issuer-entry proposal

`authority-provider.mjs` and `issuer-entry.mjs` belong to the review-only proposal
introduced by PR361 (`6674a1b9b80982ba7bc9f566ab5f7473bfe7d0a3`). This directory
keeps them separate from the immutable 12-file owner package introduced by PR347.

The provider is byte-identical to its previous location. The entry changes only
three imports to the original driver, issuer and store; their source hashes and
the historical manifest remain fixed. The authority-entry source test enforces
that import-only transformation and rejects changes to the module bodies.

Run its offline Node 26.13.0 protocol tests with:

```sh
node scripts/ci/demo-authority-entry-review/run_review.mjs --output /tmp/demo-authority-entry-evidence
```

See `scripts/ci/demo-authority-entry-review/README.md` for the proposal's scope and
remaining admission requirements. It remains `NOT_ADMITTED`, with no configured
wire or business execution permission. This relocation does not activate the
demo, change SQL/physical workflow gates, or certify database behavior.
