// Tenant-scoped business API helpers (live mode). Uses authFetch + X-Tenant-Id.
import { authFetch, MOCK } from './authApi.js';

let tenantId = null;

export function setTenantId(id) {
  tenantId = id || null;
  try {
    if (id) localStorage.setItem('byjan_tenant_id', id);
    else localStorage.removeItem('byjan_tenant_id');
  } catch (e) {}
}

export function getTenantId() {
  if (tenantId) return tenantId;
  try { tenantId = localStorage.getItem('byjan_tenant_id'); } catch (e) {}
  return tenantId;
}

async function biz(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const tid = getTenantId();
  if (tid) headers['X-Tenant-Id'] = tid;
  const r = await authFetch('/v1/biz' + path, { ...init, headers });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j && j.detail && (j.detail.message || j.detail)) || j.message || `HTTP ${r.status}`;
    throw Object.assign(new Error(typeof msg === 'string' ? msg : 'Request failed'), { status: r.status, code: j?.detail?.code || j?.code });
  }
  return j;
}

export async function loadMeAndTenant() {
  if (MOCK) return null;
  const r = await authFetch('/v1/me', { method: 'GET' });
  const me = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(me?.detail?.message || 'Could not load profile');
  const tid = me.tenants?.[0]?.id || null;
  if (tid) setTenantId(tid);
  return me;
}

export async function listParties(kind) {
  if (MOCK) return null;
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return biz('/parties' + q);
}

export async function createParty(body) {
  return biz('/parties', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateParty(id, body) {
  return biz('/parties/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(body) });
}

export async function listDocuments(type) {
  if (MOCK) return null;
  const q = type ? `?type=${encodeURIComponent(type)}` : '';
  return biz('/documents' + q);
}

export async function createDocument(body) {
  return biz('/documents', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateDocument(id, body) {
  return biz('/documents/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteDocument(id) {
  return biz('/documents/' + encodeURIComponent(id), { method: 'DELETE' });
}

export async function documentAction(id, action, body = {}) {
  return biz(
    '/documents/' + encodeURIComponent(id) + '/actions/' + encodeURIComponent(action),
    { method: 'POST', body: JSON.stringify(body || {}) },
  );
}

export async function createPayment(body) {
  return biz('/payments', { method: 'POST', body: JSON.stringify(body) });
}

export async function listItems(q) {
  if (MOCK) return null;
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return biz('/items' + qs);
}

export async function listAccounts(q) {
  if (MOCK) return null;
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return biz('/accounts' + qs);
}

/** Send branded transactional email (invoice / reminder / notice). */
export async function sendMail({ to, subject, message, kind = 'notice' }) {
  if (MOCK) return { ok: true };
  const headers = { 'Content-Type': 'application/json' };
  const tid = getTenantId();
  if (tid) headers['X-Tenant-Id'] = tid;
  const r = await authFetch('/v1/mail/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({ to, subject, message, kind }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.detail?.message || j?.message || `HTTP ${r.status}`;
    throw Object.assign(new Error(typeof msg === 'string' ? msg : 'Could not send email'), { status: r.status });
  }
  return j;
}

export function mapPartyFromApi(p) {
  if (!p) return null;
  return {
    id: p.id,
    k: p.k || (p.kind === 'supplier' ? 'v' : 'c'),
    n: p.n || p.name || '',
    g: p.g || p.gstin || '',
    e: p.e || p.email || '',
    ph: p.ph || p.phone || '',
    city: p.city || '',
    terms: p.terms || p.terms_days || 30,
    st: p.st || p.state_code || '',
  };
}

export function mapDocFromApi(d) {
  if (!d) return null;
  const lines = (d.lines || []).map(l => ({
    item: l.item || l.item_id || 'i1',
    q: String(l.q ?? l.qty ?? 1),
    r: String(l.r ?? ((l.rate_paise || 0) / 100) ?? 0),
    g: l.g ?? (l.gst_rate != null ? (Number(l.gst_rate) <= 1 ? Number(l.gst_rate) * 100 : Number(l.gst_rate)) : 18),
    desc: l.desc || l.description || '',
    acc: l.acc,
    dr: l.dr,
    cr: l.cr,
  }));
  return {
    id: d.id,
    tk: d.tk || d.type,
    no: d.no || d.number,
    st: d.st || d.status || 'Draft',
    party: d.party || d.party_id || '',
    dt: typeof d.dt === 'number' ? d.dt : 0,
    terms: d.terms || d.terms_days || 30,
    due: d.due != null ? d.due : (d.terms || d.terms_days || 30),
    lines: lines.length ? lines : [{ item: 'i1', q: '1', r: '0', g: 18 }],
    disc: d.disc || 0,
    notes: d.notes || '',
    nar: d.nar || d.narration || '',
    paid: d.paid || ((d.paid_paise || 0) / 100),
    act: d.act || [],
    ref: d.ref || d.reference || '',
  };
}
