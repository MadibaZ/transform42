#!/usr/bin/env python3
"""Stamp sw.js with a build id so every release gets its own cache name.

Run after editing ANY file in the SHELL list (or sw.js itself):   python3 stamp.py
The id is a hash of every shell file plus sw.js, so changed files can never be served from an old cache.
"""
import hashlib, os, re, sys
d = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
p = os.path.join(d, 'sw.js')
src = open(p, encoding='utf-8').read()
m = re.search(r"const SHELL = \[(.*?)\];", src, re.S)
files = re.findall(r"'\./([^']+)'", m.group(1))
norm = re.sub(r"const BUILD = '[^']*';", "const BUILD = '__BUILD__';", src)
h = hashlib.sha256(norm.encode())
for f in sorted(files):
    h.update(f.encode())
    h.update(open(os.path.join(d, f), 'rb').read())
build = h.hexdigest()[:12]
open(p, 'w', encoding='utf-8').write(re.sub(r"const BUILD = '[^']*';", "const BUILD = '%s';" % build, src))
print('BUILD =', build, '(%d shell files)' % len(files))
