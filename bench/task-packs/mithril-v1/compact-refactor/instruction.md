# compact-refactor

Refactor source formatting to fewer UTF-8 bytes without changing any compiled semantics or visible output.

Edit application.mith using the supplied goal and ontology contract. Completion requires actual Mithril compilation and the harness verifier. The ordinary JavaScript reference is executed with: node bench/ordinary-reference.mjs compact-refactor.

Refactor is format-only: preserve the entire compiled App IR, preserve ordinary HTML bytes and reduce UTF-8 source bytes.
