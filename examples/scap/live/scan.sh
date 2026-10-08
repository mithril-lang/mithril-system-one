#!/bin/sh
set -eu
oscap --version > scanner-version.txt
touch /tmp/mithril-present
oscap oval validate definitions.xml
oscap xccdf validate benchmark.xml
oscap oval eval --results oval-results.xml definitions.xml
oscap ds sds-compose benchmark.xml source-datastream.xml
set +e
oscap xccdf eval --results xccdf-results.xml --results-arf arf-results.xml --oval-results source-datastream.xml > scanner-output.txt 2> scanner-error.txt
code=$?
set -e
printf '%s\n' "$code" > scanner-exit.txt
[ "$code" = 2 ]
