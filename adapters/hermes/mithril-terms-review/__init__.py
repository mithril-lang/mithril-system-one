"""Private inert terms review. Credentials never enter the parser."""
import json
import os
from pathlib import Path
import shutil
import subprocess


def invoke(root, args):
    try:
        if not isinstance(args, dict):
            raise ValueError()
        payload = json.dumps(args, ensure_ascii=False)
        if len(payload.encode()) > 1572864:
            raise ValueError()
        path = Path(root).expanduser().resolve(strict=True)
        if json.loads((path / 'package.json').read_text()).get('name') != '@mithril/system-one':
            raise ValueError()
        result = subprocess.run([shutil.which('node'), str(path / 'bin/mithril-terms-review.mjs'), '--stdin'],
            input=payload, text=True, capture_output=True, shell=False, timeout=30, cwd=path,
            env={k: os.environ[k] for k in ('PATH', 'HOME', 'TMPDIR') if k in os.environ})
        if len(result.stdout.encode()) > 2000000:
            raise ValueError()
        value = json.loads(result.stdout)
        if result.returncode or value.get('ok') is not True:
            raise ValueError()
        return value
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': 'terms_review_outcome_unknown', 'retry': False}
    except (ValueError, TypeError, OSError):
        return {'ok': False, 'error': 'terms_review_refused', 'retry': False}


def register(ctx):
    ctx.register_tool(name='mithril_terms_review', toolset='mithril_terms_review', emoji='📄',
        handler=lambda args, **kwargs: json.dumps(invoke(ctx.get_config('system_one_root') or '', args), ensure_ascii=False),
        check_fn=lambda: bool(ctx.get_config('system_one_root')),
        description='Review supplied terms and privacy documents with hash-bound candidate and contextual evidence; no fetch or publish',
        schema={'name': 'mithril_terms_review', 'description': 'Private source-bound JA/EN review. Include complete text, provenance, UTF-8 SHA-256. Optional contextual assessments cite exact UTF-16 offsets. Rules produce candidates, not legal or honesty conclusions. No automatic publication or scheduling.',
            'parameters': {'type': 'object', 'properties': {
                'service': {'type': 'object', 'properties': {k: {'type': 'string'} for k in ('name','plan','jurisdiction','usage')}, 'required': ['name','plan','jurisdiction'], 'additionalProperties': False},
                'documents': {'type': 'array', 'minItems': 1, 'maxItems': 5, 'items': {'type': 'object', 'properties': {k: {'type': 'string'} for k in ('kind','url','retrievedAt','effectiveDate','language','text','sha256')}, 'required': ['kind','url','retrievedAt','language','text','sha256'], 'additionalProperties': False}},
                'previous': {'type': 'array', 'maxItems': 5, 'items': {'type': 'object'}},
                'assessments': {'type': 'array', 'maxItems': 50, 'items': {'type': 'object'}}},
                'required': ['service','documents'], 'additionalProperties': False}})
