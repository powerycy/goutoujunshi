# Verification map

## Existing coverage

| Use case | Rule / expected negative behavior | Evidence | Status |
| --- | --- | --- | --- |
| Object profiles | Maximum 5; no cross-object recall or write | `tests/domain.test.mjs` | Existing automated |
| Identity mapping | Conflicting sender role stops without overwrite | `tests/domain.test.mjs` | Existing automated |
| Evidence candles | Red/green/gray semantics and low-completeness gray | `tests/domain.test.mjs` | Existing automated |
| Refined memory | Compression, isolation and undo | `tests/domain.test.mjs` | Existing automated |
| Archive/restore | Stable ID/data retained; active limit still applies | `tests/domain.test.mjs` | Existing automated |
| Skill routing | Whitelist and 1–3 reference limit | `tests/adapters.test.mjs` | Existing automated |
| Protected Skill | No diff from `origin/main` in protected paths | `scripts/check-readonly.mjs` | Existing command / CI validation |
| Product UI | Desktop/mobile, K-line hover, compact settings, archive flow | `docs/DESIGN_QA.md`, screenshots | Existing manual review |

## Proposed tests

| Use case | Expected behavior | Type | Status |
| --- | --- | --- | --- |
| Live DeepSeek provider | Real response uses routed references and never logs Key | Guarded live integration | Proposed |
| Upload parsers | Malformed/oversized files fail safely | Automated integration | Proposed |
| Long-running history | Multi-year compression remains bounded and relevant | Automated property/performance | Proposed |
| Remote deployment | Authenticated users cannot access each other's objects | Automated integration | Proposed after server storage exists |

## Gaps

| Gap | Exposure | Status |
| --- | --- | --- |
| Screenshot OCR and export-file parsing are interaction placeholders | Untrusted file handling not yet exercised | None; feature not enabled |
| ChatLab/computer read-only connectors are authorization designs only | External data permissions not yet exercised | None; connectors not enabled |
| No production multi-user backend | Browser state is device-local and not suitable for shared deployment | Explicit product limitation |

`pnpm run test:all` and `pnpm run check:readonly` are required before updating the competition PR. Repository validation gates the protected Skill structure but does not claim production security certification.
