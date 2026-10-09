# Local CI

The CI gate is `npm run ci:local`, run on a clean checkout of the exact reviewed commit with Node 24 and Python 3.12. It performs both jobs from `.github/workflows/test.yml`:

| Local step | Existing workflow commands |
| --- | --- |
| dependencies | `npm ci` |
| browser-runtime | `npx playwright install --with-deps chromium firefox webkit` |
| conformance | `npm run test:all` (package/Todo, Python, three headless browsers) |
| dynamic-setup | `npm run setup:dynamic` (locked dependencies and pinned native compiler/module) |
| dynamic-runtime | `npm run test:dynamic` (actual compiler/reasoner and MCP/workflow integration) |

There is no separate build or type-check job in this package. The dynamic job executes the actual pinned Mithril compiler. Normal CI does not request model inference, dispatch GitHub Actions, publish, deploy, or modify branch protections.

```sh
# Use Node 24 and Python 3.12 on PATH. On macOS, no Linux apt dependencies are needed.
# Keep the checkout and optional browser cache outside iCloud-evicted folders.
export PLAYWRIGHT_BROWSERS_PATH=/tmp/mithril-ci-browsers
npm run ci:local -- --expected-sha "$(git rev-parse HEAD)"
```

Results default to ignored `.local-ci/<full SHA>/<timestamp>/`. An explicit `--output /tmp/new-result-directory` is also accepted. Existing result directories are refused. The summary records commit/tree identity, environment, every command, timestamps, exit codes and log SHA-256 values; command output is retained in separate logs. The runner stops on failure and checks that HEAD and the clean checkout remain unchanged afterward. Preserve results and publish them only through a separately authorized evidence-sharing path; the runner does not claim or create a GitHub check status.

Automatic `push`/`pull_request` workflow triggers are removed. The old workflow remains manual-only as a readable diagnostic recipe; local CI does not dispatch it. A protected branch may still require an external check: inspect the actual rule and stop if local evidence is insufficient, rather than changing protections or fabricating statuses.

Before merging, verify that the PR head and base still match the tested inputs. If GitHub creates a merge commit, verify its tree equals the tested tree, then run local CI again against that exact public merge SHA. Keep old experiment results attached to their original commits; combined results belong to the new SHA.
