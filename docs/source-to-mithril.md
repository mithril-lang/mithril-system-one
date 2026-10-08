# Source AST → executable Mithril

The System One harness can now convert a bounded JavaScript/TypeScript module into real executable Mithril Form. Conversion is deterministic and makes **zero inference calls**. It is a source frontend for the harness, rather than a general-purpose transpiler or a new measured LLM speedup.

The pipeline parses inert source with pinned Babel 7.28.4, checks parameter contracts, creates a checked native-module IR and a JSON-LD source ontology, emits `mithril/native-js-module` Form, compiles it using the published Mithril compiler, then executes **only the compiler artifact** in a bounded subprocess. The original source is never imported or evaluated. A separate interpreter reads the admitted original AST to provide the reference results.

This uses Mithril's **native JS backend**, which preserves native Boolean/array behavior. It is separate from the restricted Amu guest ABI and the ontology reasoning engine. The source ontology records expression syntax, inferred type and line/column; it does not itself establish vulnerability findings.

## Reproduce

Node 22+, Git and Python 3 are required. Runtime setup fetches immutable public Git commits; compiler and verification calls themselves are offline and receive no API credentials.

```sh
npm ci
npm run setup:dynamic
npm run setup:module
npm run test:convert
```

`npm ci` can remove the ignored runtime checkouts, so rerun setup after dependency installation. Existing security/dynamic compiler pins are unchanged. The source converter separately pins Mithril `f78ce5756261131509aca0a5f417923eb0c4447d` and verifies its HEAD and tracked contents before every compilation. It uses the existing pinned nbb engine, with a standalone source classpath.

Convert the included Todo logic:

```sh
node --input-type=module <<'JS' | node bin/mithril-convert.mjs --stdin
import {readFileSync} from 'node:fs';
console.log(JSON.stringify({language:'typescript',source:readFileSync('examples/source-conversion/todo.ts','utf8')}));
JS
```

The JSON response contains executable `mithril`, the checked module document, parameter/return `signatures`, `source_facts`, source JSON-LD `ontology`, native compiler `artifact`, source/artifact hashes and an independent equivalence `receipt`. The CLI returns artifacts without writing or publishing them. Save the returned `.mith` through the owning Agent/Desktop/Web workflow when desired.

For JavaScript, supply explicit parameter contracts:

```json
{"language":"javascript","source":"export const toggle = done => !done;","types":{"toggle":["bool"]}}
```

TypeScript can instead supply `boolean` / `boolean[]` parameter annotations. Declared return annotations must match the inferred type; casts are refused. Supported results are Boolean, Boolean array and array length (number).

## Supported and refused

Supported modules contain only named exported function declarations or one `export const` arrow function per declaration. A block body must contain exactly one return. Expressions include Boolean literals/locals, `!`, `&&`, `||`, `===`, `!==`, ternary conditionals, plain array `.length`, and `.filter` with one pure arrow callback. Filter callbacks can capture parameters and shadow their names. There are no imports or host grants.

Imports, top-level effects, free variables, external/function calls, recursion, assignment, async/generators, loops, destructuring, defaults/rest/optional parameters, generic types, casts and all unlisted syntax are explicitly refused before compilation. This initial release does not translate classes, framework applications, I/O, promises, Python or entire GitHub repositories.

Bounds: 16 KiB source, 8 functions, 4 parameters per function, 512 admitted expression nodes, depth 32, at most 4,096 input combinations per function and 8,192 per module. CLI/MCP input frames are bounded at 32 KiB.

## Equivalence scope

Every Boolean input combination and every **dense plain Boolean array of length 0–8** is checked. There are 511 such arrays. The Todo fixture verifies 513 cases (2 toggle + 511 count), and the conditional refactor fixture passes the same contract. Each input combination is compared to the separate admitted-source AST interpreter with deep equality.

This is bounded exhaustive equivalence, **not** a proof for arbitrary JavaScript values, sparse arrays, proxies, overridden array methods, longer arrays or full-program behavior. The emitted native artifact expects the declared input contract; its exports are not a sandbox for arbitrary host objects. Compiler/check time is returned in each receipt and includes process startup. Zero inference does not imply zero infrastructure cost.

## Harness entry points

- Library: `convertSource` from `lib/source-to-mithril.mjs` / package subpath `./convert`.
- CLI: `node bin/mithril-convert.mjs --stdin`.
- Existing MCP: `node bin/mithril-mcp.mjs`, tool `mithril_source_convert`, with the same JSON arguments. Existing task/workflow tools remain available.
- Hermes/Mithril Agent: standalone plugin `adapters/hermes/mithril-source-convert`, toolset `mithril_source_convert`.

For an owning profile, install that plugin directory under its `plugins/`, configure `plugins.mithril-source-convert.system_one_root` to the reviewed checkout, enable the plugin and add `mithril_source_convert` to the profile's enabled toolsets. Start a new chat after configuration so tool definitions stay stable within a session. This plugin requires no API key and does not change other profiles or core Agent code.

The plugin and MCP execute the same fixed CLI/compiler boundaries. They do not install target dependencies, run target tests, write Git, publish repositories or perform vulnerability remediation. Errors and unknown outcomes are not retried. Existing Registry consumers retain their reviewed artifact pins until explicitly upgraded; this release does not claim production Web/Desktop rollout or registry activation.
