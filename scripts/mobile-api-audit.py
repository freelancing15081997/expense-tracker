"""Cross-check every (endpoint, op) the Byjan Books mobile app sends against the server.

Usage: python3 scripts/mobile-api-audit.py apps/books-mobile/src .
Prints a table and exits 1 if any client op has no server handler.
"""
import re
import sys
from pathlib import Path

client_dir = Path(sys.argv[1])
server = Path(sys.argv[2])

# ---------- client side ----------
CALL = re.compile(r"apiPost(?:<[^()]*?>)?\(\s*['\"`](/api/[A-Za-z/_-]+)['\"`]\s*,\s*\{([^}]*)", re.S)
OP = re.compile(r"\bop:\s*['\"`]([A-Za-z_]+)['\"`]")
client = {}  # (path, op) -> [locations]
unparsed = []
for f in sorted(client_dir.rglob('*.ts*')):
    text = f.read_text()
    for m in CALL.finditer(text):
        path, body = m.group(1), m.group(2)
        line = text.count('\n', 0, m.start()) + 1
        loc = f"{f.relative_to(client_dir)}:{line}"
        ops = OP.findall(body)
        if not ops:
            # op may be passed through a variable (e.g. saas(op, ...)); record for manual review
            unparsed.append((path, loc, body.strip()[:70]))
            continue
        for op in ops:
            client.setdefault((path, op), []).append(loc)

# helper wrappers that forward an op variable: saas('x'), callMoney('x') etc.
WRAP_DEF = re.compile(r"(?:const|function)\s+([A-Za-z_]+)\s*=?\s*(?:async\s*)?\(?\s*op\b[^=]*?=>\s*apiPost[^(]*\(\s*['\"`](/api/[A-Za-z/_-]+)['\"`]", re.S)
wrappers = {}
for f in client_dir.rglob('*.ts*'):
    for m in WRAP_DEF.finditer(f.read_text()):
        wrappers[m.group(1)] = m.group(2)
for name, path in wrappers.items():
    use = re.compile(rf"\b{name}(?:<[^()]*?>)?\(\s*['\"`]([A-Za-z_]+)['\"`]")
    for f in client_dir.rglob('*.ts*'):
        text = f.read_text()
        for m in use.finditer(text):
            line = text.count('\n', 0, m.start()) + 1
            client.setdefault((path, m.group(1)), []).append(f"{f.relative_to(client_dir)}:{line}")

# ---------- server side ----------
SOP = re.compile(r"op\w*\s*===\s*['\"]([A-Za-z_]+)['\"]")
SCASE = re.compile(r"case\s+['\"]([A-Za-z_]+)['\"]\s*:")


def ops_in(text):
    return set(SOP.findall(text)) | set(SCASE.findall(text))


server_ops = {}
tracker = (server / 'api/tracker.ts').read_text()
# split tracker into its per-domain handler functions
handlers = {
    'ledgers': 'handleLedgers', 'expenses': 'handleExpenses', 'notifications': 'handleNotifications',
    'me': 'handleMe', 'support': 'handleSupport', 'books': 'handleBooks',
}
starts = sorted((tracker.find(f'async function {fn}('), dom) for dom, fn in handlers.items())
starts = [(s, d) for s, d in starts if s >= 0]
end_marker = tracker.find('export default async function handler')
for i, (s, dom) in enumerate(starts):
    e = starts[i + 1][0] if i + 1 < len(starts) else end_marker
    server_ops[f'/api/{dom}'] = ops_in(tracker[s:e])

lib = server / 'api/_lib'
money = set()
for name in ('money-handlers.ts', 'money-extras.ts'):
    p = lib / name
    if p.exists():
        money |= ops_in(p.read_text())
# money ops handled inline in tracker's default handler
money |= ops_in(tracker[end_marker:])
server_ops['/api/money'] = money
for dom, name in (('saas', 'saas-handlers.ts'), ('owner', 'owner-handlers.ts')):
    p = lib / name
    server_ops[f'/api/{dom}'] = ops_in(p.read_text()) if p.exists() else set()
inv = server / 'api/invites.ts'
server_ops['/api/invites'] = ops_in(inv.read_text()) | (ops_in((lib / 'invite-links.ts').read_text()) if (lib / 'invite-links.ts').exists() else set())
email = server / 'api/email/send.ts'
server_ops['/api/email/send-report'] = {'*'}  # no op: dedicated route

# ---------- compare ----------
missing = []
print(f"{'endpoint':<26}{'op':<26}{'server':<8}client call sites")
for (path, op), locs in sorted(client.items()):
    have = server_ops.get(path)
    ok = have is not None and ('*' in have or op in have)
    if not ok:
        missing.append((path, op, locs))
    print(f"{path:<26}{op:<26}{'OK' if ok else 'MISSING':<8}{', '.join(locs[:3])}{' …' if len(locs) > 3 else ''}")
print(f"\n{len(client)} client (endpoint, op) pairs, {len(missing)} missing on the server")
if unparsed:
    print("\nCalls with no literal op (review by hand):")
    for path, loc, body in unparsed:
        print(f"  {path:<26}{loc:<28}{body}")
sys.exit(1 if missing else 0)
