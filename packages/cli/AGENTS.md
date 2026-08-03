# Agent Information — `@broadsec-manual/cli`

The `broadsec-manual` command line. **The only package allowed to touch the
filesystem, the network or the clock.**

## Commands

| Command | Does |
|---|---|
| `build <manual> --tenant <id>` | Assemble and render one manual for one target |
| `build <manual> --all` | Every configured target |
| `validate <manual>` | Run all validations, render nothing |
| `drift <manual>` | Re-extract the source repo and diff against `knowledge/` |
| `extract <source>` | Regenerate `module-map.json` from a source repo |
| `catalog` | Serve the block gallery |
| `coverage <manual>` | Report dead content and per-target gaps |

## Rules

- **Thin.** Read inputs, call `core`, write outputs, format errors. Any decision
  made here is a decision in the wrong package — pipeline logic belongs in
  `core`, where it can be tested without a filesystem.
- **Never write under `sources/`.** Source product repositories are read-only
  inputs. Enforce it; do not merely intend it.
- **Build output goes to `manuals/<manual>/output/`**, which is gitignored.
  Generated PDFs are never committed.
- **Non-zero exit on validation failure.** This runs in CI.
- **Errors are actionable**: file, node id, what to do. A stack trace is not an
  error message.
- `--tenant` is shorthand for the general axis form. Keep the general form
  available so a second axis does not require a new CLI surface.

## Testing

Command wiring and argument parsing are tested. Pipeline behaviour is tested in
`core` — do not re-test it through the CLI, and do not push logic here to avoid
writing those tests.
