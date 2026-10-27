/**
 * dsh-session-tags — Host half.
 *
 * Stores `sessionId -> tag paths[]` plus one color per tag path in one JSON file
 * under the DSH home, and serves it to the browser half over an owner-only HTTP
 * route. It never reads or writes session logs; it only folds titles from the
 * public session-query service.
 *
 * Tag paths are slash-separated (`work/cfgf/fig2`), so the panel can render a
 * directory-like tree. Ancestor paths are created implicitly with their own
 * color and can carry sessions too.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const DATA_DIR = path.join(HOME, 'session-tags');
const DATA_FILE = path.join(DATA_DIR, 'tags.json');
const ROUTE = '/session-tags/api';
const MAX_BODY = 64 * 1024;
const MAX_TAGS = 500;
const MAX_TAGS_PER_SESSION = 30;
const MAX_TAG_LEN = 40;
const MAX_DEPTH = 5;

const PALETTE = [
  '#4C8DFF',
  '#34C759',
  '#FF9F0A',
  '#FF453A',
  '#BF5AF2',
  '#5AC8FA',
  '#FFD60A',
  '#30D158',
  '#FF375F',
  '#64D2FF',
];

let store = loadStore();

function emptyStore() {
  return { version: 2, tags: [], assignments: {} };
}

function keyOf(name) {
  return String(name).trim().toLocaleLowerCase();
}

function normalizeColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : '';
}

function nextColor() {
  return PALETTE[store.tags.length % PALETTE.length];
}

function splitPath(name) {
  if (typeof name !== 'string') return [];
  const parts = name
    .trim()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
    .split('/');
  const out = [];
  for (const part of parts) {
    const seg = part.trim().replace(/\s+/g, ' ');
    if (!seg) continue;
    if (/[\u0000-\u001f\u007f]/.test(seg)) continue;
    out.push(seg);
  }
  return out.slice(0, MAX_DEPTH);
}

function normalizePath(name) {
  const parts = splitPath(name);
  if (!parts.length) return '';
  const joined = parts.join('/');
  return joined.length > MAX_TAG_LEN ? '' : joined;
}

function normalizeTags(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const name = normalizePath(raw);
    if (!name) continue;
    const key = keyOf(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_TAGS_PER_SESSION) break;
  }
  return out;
}

function findTag(name) {
  const key = keyOf(name);
  return store.tags.find((tag) => keyOf(tag.name) === key) || null;
}

function ensureTag(name) {
  const full = normalizePath(name);
  if (!full) return '';
  const parts = full.split('/');
  let prefix = '';
  for (const part of parts) {
    prefix = prefix ? prefix + '/' + part : part;
    if (findTag(prefix)) continue;
    if (store.tags.length >= MAX_TAGS) return full;
    store.tags.push({ name: prefix, color: nextColor() });
  }
  return full;
}

function normalize(input) {
  const nextTags = [];
  const seen = new Set();
  const rawTags = Array.isArray(input?.tags) ? input.tags : [];
  for (const raw of rawTags) {
    const rawName = typeof raw === 'string' ? raw : raw && raw.name;
    const full = normalizePath(rawName);
    if (!full) continue;
    const parts = full.split('/');
    let prefix = '';
    for (const part of parts) {
      prefix = prefix ? prefix + '/' + part : part;
      const key = keyOf(prefix);
      if (seen.has(key)) continue;
      if (nextTags.length >= MAX_TAGS) break;
      const declared = full === prefix ? normalizeColor(typeof raw === 'object' ? raw.color : null) : '';
      seen.add(key);
      nextTags.push({ name: prefix, color: declared || PALETTE[nextTags.length % PALETTE.length] });
    }
  }
  const assignments = {};
  if (input?.assignments && typeof input.assignments === 'object' && !Array.isArray(input.assignments)) {
    for (const [sessionId, list] of Object.entries(input.assignments)) {
      if (!isValidSessionId(sessionId)) continue;
      const tags = normalizeTags(list);
      if (!tags.length) continue;
      assignments[sessionId] = tags;
      for (const name of tags) {
        const parts = name.split('/');
        let prefix = '';
        for (const part of parts) {
          prefix = prefix ? prefix + '/' + part : part;
          const key = keyOf(prefix);
          if (seen.has(key)) continue;
          if (nextTags.length >= MAX_TAGS) break;
          seen.add(key);
          nextTags.push({ name: prefix, color: PALETTE[nextTags.length % PALETTE.length] });
        }
      }
    }
  }
  return { version: 2, tags: nextTags, assignments };
}

function loadStore() {
  try {
    return normalize(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch {
    return emptyStore();
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
  try {
    fs.chmodSync(DATA_FILE, 0o600);
  } catch {
    // best effort; Windows has no POSIX mode
  }
}

function isValidSessionId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 200 && !/[\u0000-\u001f\u007f]/.test(id);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function setSessionTags(sessionId, tags) {
  if (!isValidSessionId(sessionId)) throw httpError(400, '无效的会话 ID');
  const clean = normalizeTags(tags);
  if (clean.length) {
    store.assignments[sessionId] = clean;
    for (const name of clean) ensureTag(name);
  } else {
    delete store.assignments[sessionId];
  }
  saveStore();
}

function renameTag(fromRaw, toRaw) {
  const from = normalizePath(fromRaw);
  const to = normalizePath(toRaw);
  if (!from || !to) throw httpError(400, '标签名无效');
  const fromKey = keyOf(from);
  const toKey = keyOf(to);
  if (!store.tags.some((tag) => keyOf(tag.name) === fromKey)) throw httpError(404, '标签不存在');
  if (fromKey === toKey) return;

  const affected = store.tags.filter((tag) => {
    const key = keyOf(tag.name);
    return key === fromKey || key.startsWith(fromKey + '/');
  });
  const kept = store.tags.filter((tag) => !affected.includes(tag));
  const finals = new Map();
  for (const tag of affected) {
    const name = to + tag.name.slice(from.length);
    const key = keyOf(name);
    if (!finals.has(key)) finals.set(key, { name, color: tag.color });
  }
  for (const entry of Array.from(finals.values())) {
    const parts = entry.name.split('/');
    let prefix = '';
    for (const part of parts) {
      prefix = prefix ? prefix + '/' + part : part;
      const key = keyOf(prefix);
      if (finals.has(key) || kept.some((tag) => keyOf(tag.name) === key)) continue;
      finals.set(key, { name: prefix, color: PALETTE[(kept.length + finals.size) % PALETTE.length] });
    }
  }
  store.tags = kept;
  for (const entry of finals.values()) {
    if (store.tags.some((tag) => keyOf(tag.name) === keyOf(entry.name))) continue;
    store.tags.push(entry);
  }
  for (const [sessionId, list] of Object.entries(store.assignments)) {
    const out = [];
    const seen = new Set();
    for (const name of list) {
      const key = keyOf(name);
      const hit = key === fromKey || key.startsWith(fromKey + '/');
      const next = hit ? to + name.slice(from.length) : name;
      const nextKey = keyOf(next);
      if (seen.has(nextKey)) continue;
      seen.add(nextKey);
      out.push(next);
    }
    if (out.length) store.assignments[sessionId] = out;
    else delete store.assignments[sessionId];
  }
  saveStore();
}

function deleteTag(raw) {
  const target = normalizePath(raw);
  if (!target) throw httpError(400, '标签名无效');
  const targetKey = keyOf(target);
  const gone = new Set(
    store.tags
      .filter((tag) => {
        const key = keyOf(tag.name);
        return key === targetKey || key.startsWith(targetKey + '/');
      })
      .map((tag) => keyOf(tag.name)),
  );
  if (!gone.size) throw httpError(404, '标签不存在');
  store.tags = store.tags.filter((tag) => !gone.has(keyOf(tag.name)));
  for (const [sessionId, list] of Object.entries(store.assignments)) {
    const next = list.filter((name) => !gone.has(keyOf(name)));
    if (next.length) store.assignments[sessionId] = next;
    else delete store.assignments[sessionId];
  }
  saveStore();
}

function setTagColor(raw, colorRaw) {
  const name = normalizePath(raw);
  const color = normalizeColor(colorRaw);
  if (!name) throw httpError(400, '标签名无效');
  if (!color) throw httpError(400, '颜色必须是 #rrggbb');
  const tag = findTag(name);
  if (!tag) throw httpError(404, '标签不存在');
  tag.color = color;
  saveStore();
}

function workspaceLabel(cwd, registry) {
  if (!cwd || typeof cwd !== 'string') return '';
  const normalized = cwd.replace(/[\\/]+$/, '');
  let best = '';
  for (const ws of registry) {
    const wsPath = String(ws.path || '').replace(/[\\/]+$/, '');
    if (!wsPath) continue;
    if (normalized === wsPath || normalized.startsWith(wsPath + '/') || normalized.startsWith(wsPath + '\\')) {
      if (wsPath.length > best.length) best = wsPath;
    }
  }
  if (best) {
    const match = registry.find((ws) => String(ws.path || '').replace(/[\\/]+$/, '') === best);
    if (match?.title) return match.title;
  }
  return path.basename(normalized) || normalized;
}

function registryOf(ctx) {
  try {
    const registry = ctx.get('workspaceRegistry');
    return registry && typeof registry.list === 'function' ? registry.list() : [];
  } catch {
    return [];
  }
}

async function readSessionInfo(ctx, ids) {
  const info = new Map();
  const sq = ctx.get('sessionQuery');
  if (sq && typeof sq.readTitleSnapshots === 'function') {
    try {
      const results = await sq.readTitleSnapshots(ids);
      for (const result of results || []) {
        if (result?.status === 'fulfilled') {
          const header = result.value?.session;
          info.set(result.sessionId, {
            title: result.value?.title?.title || null,
            cwd: header?.cwd || null,
          });
        }
      }
    } catch {
      // fall through to the live store
    }
  }
  const live = ctx.get('sessions');
  if (live && typeof live.list === 'function') {
    try {
      for (const session of live.list()) {
        if (info.has(session.id)) continue;
        info.set(session.id, { title: null, cwd: session.header?.cwd || null });
      }
    } catch {
      // ignore
    }
  }
  return info;
}

async function snapshot(ctx, extraSessionId) {
  const counts = new Map();
  for (const list of Object.values(store.assignments)) {
    for (const name of list) {
      const key = keyOf(name);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const ids = new Set(Object.keys(store.assignments));
  if (isValidSessionId(extraSessionId)) ids.add(extraSessionId);
  const registry = registryOf(ctx);
  const sessions = {};
  if (ids.size) {
    const info = await readSessionInfo(ctx, [...ids]);
    for (const id of ids) {
      const entry = info.get(id) || {};
      sessions[id] = {
        id,
        title: entry.title || null,
        cwd: entry.cwd || null,
        workspace: workspaceLabel(entry.cwd, registry),
      };
    }
  }
  return {
    ok: true,
    palette: PALETTE,
    tags: store.tags.map((tag) => ({ name: tag.name, color: tag.color, count: counts.get(keyOf(tag.name)) || 0 })),
    assignments: store.assignments,
    sessions,
  };
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(httpError(413, '请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function admit(ctx, req) {
  const connection = ctx.get('connection');
  if (!connection || typeof connection.admit !== 'function') {
    return { ok: false, status: 503, error: '认证服务不可用，已拒绝请求' };
  }
  let admission;
  try {
    admission = connection.admit(req);
  } catch {
    return { ok: false, status: 403, error: '认证检查失败' };
  }
  if (!admission || typeof admission !== 'object') return { ok: false, status: 401, error: '未授权' };
  if ('rejection' in admission) return { ok: false, status: Number(admission.rejection) || 401, error: '禁止访问' };
  const peer = admission.peer;
  if (!peer || peer.principal?.kind !== 'owner') return { ok: false, status: 403, error: '仅限 owner' };
  return { ok: true };
}

function createHandler(ctx) {
  return async (req, res) => {
    const auth = admit(ctx, req);
    if (!auth.ok) return send(res, auth.status, { ok: false, error: auth.error });
    try {
      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'http://localhost');
        return send(res, 200, await snapshot(ctx, url.searchParams.get('sessionId')));
      }
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' });
      const raw = await readBody(req);
      let body;
      try {
        body = raw.trim() ? JSON.parse(raw) : {};
      } catch {
        return send(res, 400, { ok: false, error: '请求体不是合法 JSON' });
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return send(res, 400, { ok: false, error: '请求体必须是 JSON 对象' });
      }
      if (body.op === 'setSessionTags') setSessionTags(body.sessionId, body.tags);
      else if (body.op === 'renameTag') renameTag(body.from, body.to);
      else if (body.op === 'deleteTag') deleteTag(body.tag);
      else if (body.op === 'setTagColor') setTagColor(body.tag, body.color);
      else return send(res, 400, { ok: false, error: '未知操作' });
      return send(res, 200, await snapshot(ctx));
    } catch (err) {
      const status = err && err.status ? err.status : 500;
      return send(res, status, { ok: false, error: String((err && err.message) || err) });
    }
  };
}

export function apply(ctx) {
  const handler = createHandler(ctx);
  ctx.inject(['webServer'], (scoped) => {
    scoped.effect(() => scoped.webServer.register({ kind: 'exact', path: ROUTE, handler }));
  });
}
