# TodoMVC coverage contract

Specification: https://github.com/tastejs/todomvc/blob/master/app-spec.md (reviewed 2026-10-07 JST).

Coverage here means executable functional checks against the exported app, not a statement/branch coverage percentage or official TodoMVC certification.

| Requirement | Browser scenarios in examples/todo/test/todo.spec.mjs |
| --- | --- |
| No todos: main/footer hidden | empty state; empty edit; clear completed |
| New todo: focus, Enter, append, trim, reject blanks, clear input | empty state; Enter; IME |
| Mark all: update all items and individual-derived master state | individual completion; master including hidden items; clear completed |
| Item: completion class, double-click editing, hover deletion | individual completion; editing; hover delete |
| Editing: focus/prefill, hide controls, Enter/blur save, trim, empty delete, Escape cancel | editing; blur/Escape; two empty edit cases; IME |
| Counter: active count, strong element, singular/plural including zero | individual completion |
| Clear completed: visibility, preserve active, reset master | empty state; clear completed |
| Persistence: localStorage, id/title/completed, exclude edit state | persisted schema; legacy migration; invalid/storage failure |
| Routing: all/active/completed, selected link, filtered updates, reload/history | all routes; master including hidden items |

Additional regression cases cover safe text rendering, absent runtime assets, policy digest mismatch and a captured-node 100-task completion/deletion workload.

`examples/todo/test/core.test.mjs` independently checks both toggle inputs, all 511 boolean vectors of lengths 0–8, malformed input refusal and the shipped runtime/policy integrity.

The browser suite runs each of 20 scenarios with Chromium, Firefox and WebKit. These are Playwright browser builds, not qualification of every production browser, OS, mobile device or assistive technology. GitHub Actions repeats the suite on Linux and retains failure traces and the report for 14 days.

## Generation boundary

Only toggle and unfinished-count logic in logic.json is model-generated. UI, add/edit/delete, bulk completion, filtering and persistence are maintained host JavaScript. Improving functional coverage does not imply that System One generated the whole Todo app, establish model success rates, or provide a speed comparison.

metrics.json is a required runtime input and records the original generation. The generation timings are not re-labelled as timings for these later maintenance changes.
