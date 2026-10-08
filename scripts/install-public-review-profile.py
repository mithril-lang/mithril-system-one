#!/usr/bin/env python3
"""Install one independent review profile. No keys, channels, cron or active-profile change."""
import argparse
import json
import os
from pathlib import Path

PROFILE = 'mithril-public-code-review'
PLUGIN = 'mithril-public-review'


def install(root, home, apply=False):
    root = Path(root).resolve(strict=True)
    home = Path(home).expanduser()
    if not home.is_absolute():
        raise ValueError('absolute Hermes home required')
    for parent in [home, *home.parents]:
        if parent.is_symlink():
            raise ValueError('symlink home ancestor refused')
    target = home / 'profiles' / PROFILE
    plan = {}
    for name in ('SOUL.md', 'USER.md', 'profile.yaml', 'config.yaml'):
        content = (root / 'profiles' / PROFILE / name).read_text()
        if name == 'config.yaml':
            content = content.replace('${system_one_root}', json.dumps(str(root)))
        plan[target / name] = content
    plan[target / 'profile-meta.json'] = json.dumps({'name': 'Mithril Public Code Review'}) + '\n'
    plan[target / '.no-bundled-skills'] = ''
    for name in ('plugin.yaml', '__init__.py'):
        plan[target / 'plugins' / PLUGIN / name] = (root / 'adapters' / 'hermes' / PLUGIN / name).read_text()
    # Preflight the entire plan before writing. Preserve every existing file.
    for path, content in plan.items():
        for parent in [path, *path.parents]:
            if parent.is_symlink():
                raise ValueError('symlink destination refused')
        if path.exists() and (not path.is_file() or path.read_text() != content):
            raise ValueError('existing profile differs: ' + path.name)
    if apply:
        for path, content in plan.items():
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            if not path.exists():
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, 'w') as stream:
                    stream.write(content)
    return {'applied': apply, 'profile': PROFILE, 'path': str(target), 'providerCredentialConfigured': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    print(json.dumps(install(Path(__file__).resolve().parents[1], args.home, args.apply)))
