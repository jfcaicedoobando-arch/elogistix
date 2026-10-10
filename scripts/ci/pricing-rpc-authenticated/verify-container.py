#!/usr/bin/env python3
"""Validate the Docker isolation contract; emit only bounded evidence metadata."""
import json
from pathlib import Path
import re
import sys

IMAGE = 'postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae'


def verify_container(data, arm, sources, cid):
    if len(data) != 1 or data[0]['Id'] != cid or not re.fullmatch('[a-f0-9]{64}', cid):
        raise ValueError('Container identity mismatch')
    c = data[0]
    host, config = c['HostConfig'], c['Config']
    if (host['NetworkMode'] != 'none' or host['Privileged'] or config['User'] != 'postgres'
            or host['CapDrop'] != ['ALL'] or host.get('CapAdd')
            or host['SecurityOpt'] not in (['no-new-privileges'], ['no-new-privileges=true'])
            or host['PidsLimit'] != 128 or host['Memory'] != 1073741824
            or host['NanoCpus'] != 2000000000 or host.get('PortBindings')
            or host.get('PidMode') or host.get('Devices') or host.get('DeviceRequests')):
        raise ValueError('Container isolation settings differ')
    if (config['Image'] != IMAGE or config['Entrypoint'] != ['/bin/bash']
            or config['Cmd'] != ['/candidate/run-arm.sh', arm]
            or 'PRICING_AUTH_ISOLATED_CONTAINER=1' not in config['Env']):
        raise ValueError('Container image/entrypoint/arm mismatch')
    # Image defaults are public PostgreSQL package metadata; no host env is inherited.
    allowed_env = {'PATH', 'GOSU_VERSION', 'LANG', 'PG_MAJOR', 'PG_VERSION', 'PG_SHA256',
                   'PGDATA', 'PRICING_AUTH_ISOLATED_CONTAINER'}
    env_names = [v.split('=', 1)[0] for v in config['Env']]
    if len(set(env_names)) != len(env_names) or set(env_names) - allowed_env:
        raise ValueError('Unexpected container environment')
    binds, volumes = {}, []
    for mount in c['Mounts']:
        if mount['Type'] == 'bind':
            if mount['RW'] or mount['Destination'] in binds:
                raise ValueError('Writable or duplicate input mount')
            binds[mount['Destination']] = mount['Source']
        elif (mount['Type'] == 'volume' and mount['Destination'] == '/var/lib/postgresql/data'
              and mount['Driver'] == 'local' and re.fullmatch('[a-f0-9]{64}', mount['Name'])):
            volumes.append(mount['Name'])
        else:
            raise ValueError('Unexpected Docker mount')
    if binds != sources or len(volumes) > 1:
        raise ValueError('Unexpected or missing allowlisted mounts')
    return {'container_id': cid, 'arm': arm, 'image': IMAGE, 'isolated': True,
            'readonly_inputs': binds, 'anonymous_volumes': volumes}


if __name__ == '__main__':
    if len(sys.argv) != 7 or sys.argv[2] not in ('baseline', 'candidate'):
        raise SystemExit('Usage: verify-container.py INSPECT ARM BUNDLE CANDIDATE OVERLAY CID')
    sources = dict(zip(('/bundle', '/candidate', '/overlay'), sys.argv[3:6]))
    print(json.dumps(verify_container(json.loads(Path(sys.argv[1]).read_text()), sys.argv[2], sources, sys.argv[6]), indent=2))
