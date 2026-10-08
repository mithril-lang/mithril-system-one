#!/usr/bin/env python3
"""Install one independent review profile. No keys, channels, cron or active-profile change."""
import argparse
import json
import hashlib
import tempfile
import os
from pathlib import Path

PROFILE = 'mithril-public-code-review'
PLUGIN = 'mithril-public-review'


def install(root, home, apply=False, upgrade=False, tool_only=False):
    root = Path(root).resolve(strict=True)
    home = Path(home).expanduser()
    if not home.is_absolute():
        raise ValueError('absolute Hermes home required')
    for parent in [home, *home.parents]:
        if parent.is_symlink():
            raise ValueError('symlink home ancestor refused')
    target = home / 'profiles' / PROFILE
    plan = {}
    for name in (('SOUL.md', 'profile.yaml') if tool_only else ('SOUL.md', 'USER.md', 'profile.yaml', 'config.yaml')):
        content = (root / 'profiles' / PROFILE / name).read_text()
        if name == 'config.yaml':
            content = content.replace('${system_one_root}', json.dumps(str(root)))
        plan[target / name] = content
    if tool_only and not (target / 'config.yaml').is_file():
        raise ValueError('tool upgrade requires an existing profile')
    plan[target / 'profile-meta.json'] = json.dumps({'name': 'Mithril Public Code Review'}) + '\n'
    plan[target / '.no-bundled-skills'] = ''
    for name in ('plugin.yaml', '__init__.py'):
        plan[target / 'plugins' / PLUGIN / name] = (root / 'adapters' / 'hermes' / PLUGIN / name).read_text()
    reviewed = json.loads((root / 'profiles' / PROFILE / 'reviewed-upgrade-hashes.json').read_text())
    updates = set()
    # Preflight the entire plan before writing. Preserve every existing file.
    for path, content in plan.items():
        for parent in [path, *path.parents]:
            if parent.is_symlink():
                raise ValueError('symlink destination refused')
        if path.exists() and (not path.is_file() or path.read_text() != content):
            rel = path.relative_to(target).as_posix()
            if not upgrade or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() not in (reviewed.get(rel) if isinstance(reviewed.get(rel), list) else [reviewed.get(rel)]):
                raise ValueError('existing profile differs: ' + path.name)
            updates.add(path)
    if apply:
        for path, content in plan.items():
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            if path in updates:
                fd, temp = tempfile.mkstemp(prefix='.review-upgrade-', dir=path.parent)
                try:
                    with os.fdopen(fd, 'w') as stream:
                        stream.write(content)
                    os.replace(temp, path)
                finally:
                    if os.path.exists(temp):
                        os.unlink(temp)
            elif not path.exists():
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, 'w') as stream:
                    stream.write(content)
    return {'applied': apply, 'profile': PROFILE, 'path': str(target), 'credentialsTouched': False, 'upgradedFiles': len(updates)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--tool-only', action='store_true', help='Update reviewed tool/instruction files while preserving operator config')
    parser.add_argument('--upgrade', action='store_true', help='Replace only unchanged, hash-reviewed prior profile/plugin files')
    args = parser.parse_args()
    print(json.dumps(install(Path(__file__).resolve().parents[1], args.home, args.apply, args.upgrade, args.tool_only)))
