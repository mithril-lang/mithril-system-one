# repair-shape

Resolve a schema/view mismatch so the report satisfies its template-to-shape contract and its visible content stays unchanged.

Edit application.mith using the supplied goal and ontology contract. Completion requires actual Mithril compilation and the harness verifier. The ordinary JavaScript reference is executed with: node bench/ordinary-reference.mjs repair-shape.

Match all goal content, template and derived shape. Preserve the approved ontology/library bindings.
