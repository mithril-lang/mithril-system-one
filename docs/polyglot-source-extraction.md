# Polyglot source → Mithril ontology

The source extractor supports C (`.c`, `.h`), C++ (`.cc`, `.cpp`, `.cxx`, `.hpp`, `.hh`, `.hxx`), Java, C# (`.cs`, the initial .NET frontend), PHP, Ruby, Python, Go, Rust, Kotlin, Swift and Scala. Existing JavaScript/TypeScript security extraction is preserved. A `.h` file is interpreted as C; use an explicit C++ extension for C++ headers. VB.NET, F#, COBOL, ABAP and vendor-specific SQL are not supported by this profile.

This is an inert source ontology frontend, separate from the bounded executable JS/TS converter. It extracts concrete syntax definitions, imports and calls, byte spans, UTF-8 byte columns, source digests and syntactic ownership relationships. Parser error or missing grammar runtime returns an explicit incomplete result with no facts. Tree-sitter accepts syntax; it does not type-check, link dependencies, run macros, import submitted modules or execute target code.

## Offline owner setup

Use a dedicated virtual environment with the exact bundled-grammar profile:

```sh
python3 -m venv /absolute/private/source-parser
/absolute/private/source-parser/bin/python -m pip install --require-hashes --only-binary=:all: -r runtime/source-parser-requirements.txt
export MITHRIL_SOURCE_PYTHON=/absolute/private/source-parser/bin/python
npm ci --ignore-scripts
npm run test:extract
```

The older bundled `tree-sitter-language-pack` 0.13.0 profile is intentional: extraction must not download parsers dynamically. Installation uses PyPI wheel SHA-256 hashes. All five parser distribution versions are checked before every parse. The owner selects the absolute Python executable; tool callers cannot supply commands, interpreters or environment values. The parser child uses isolated Python mode and a minimal environment with no inherited API credentials. Calls are bounded to 5 seconds, 256 KiB source, 50,000 syntax nodes, 2,000 facts and 2 MB output. CLI/MCP accepts at most 16 KiB source in a 32 KiB frame.

```sh
printf '%s\n' '{"path":"example.py","source":"def toggle(done):\n return not done\n"}' | node bin/mithril-source-extract.mjs --stdin
```

Library: `extractSourceOntology` from `@mithril/system-one/extract`. MCP: `mithril_source_extract` on the existing `bin/mithril-mcp.mjs` server. A successful response includes source ontology JSON-LD, inert JSON-LD `.mith` source, syntax facts and the actual extraction receipt. The receipt records parser versions, digests, zero inference calls and no target execution. Compilation/reasoning receipts are separate and are not invented by extraction.

## Public repository review

The public review CLI and Agent adapter now select these extensions from the immutable GitHub tree. Git blob SHA-1 and source SHA-256 checks, visibility/path guards and acquisition limits remain in effect. At most 100 files / 5 MiB are selected; total polyglot facts are capped at 4,000. `source_ontologies` carries each file's facts and parser receipt; unsupported syntax/runtime is reported in the file inventory. Partial coverage always remains `review_incomplete`.

Process API spellings such as `system`, `shell_exec` and `subprocess.run` are candidate observations. Library binding resolution, shadowing, data flow, shell flags and exploitability are unverified in this profile. Both `userControlled` and `shell` remain unknown, so a syntactic match cannot become a confirmed policy vulnerability. Comments and string contents do not generate calls. No target dependencies or tests are executed; no GitHub writes, inference or deployment occur.

The existing dependency assessment still has its own ecosystem/lockfile scope. Supporting Java/C# source syntax does not imply Maven/NuGet version coverage. Likewise, syntax extraction is not an executable C/Java/.NET-to-Mithril transpiler or a full CodeGraph index migration.

Parser API reference: https://github.com/xberg-io/tree-sitter-language-pack
