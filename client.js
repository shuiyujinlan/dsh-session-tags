window.__ModuleLoader__.load({
  id: 'dsh-session-tags',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const ROUTE = '/session-tags/api';
    const LS_COLLAPSED = 'dsh-session-tags:collapsed';
    const LS_SECTION = 'dsh-session-tags:section';
    const HOST_SELECTOR = '.bhn1Oq_root';
    const LIST_SELECTOR = '.bhn1Oq_listArea';
    const FALLBACK_COLOR = '#8E8E93';

    const EN = {
      entry: 'Tags',
      title: 'Tag groups',
      inlineEmpty: 'No tags yet. Open a conversation and use the tag button beside its title, or hover a session row.',
      tagSession: 'Tags',
      editorTitle: 'Tags for this session',
      editorEmpty: 'No tags yet. Type one below; use / for sub-tags.',
      loading: 'Loading…',
      retry: 'Retry',
      refresh: 'Refresh',
      rename: 'Rename',
      remove: 'Delete tag',
      color: 'Color',
      removeConfirm: 'Delete tag "{name}" and its sub-tags? Sessions keep their other tags.',
      confirm: 'Delete',
      newTag: 'New tag (use / for sub-tags)',
      add: 'Add',
      save: 'Save',
      cancel: 'Cancel',
      untitled: 'Untitled session',
      noWorkspace: 'No workspace',
      openFailed: 'Could not open this session.',
    };
    const ZH = {
      entry: '标签',
      title: '标签分组',
      inlineEmpty: '还没有标签。打开会话点标题旁的标签按钮，或在会话行悬停点标签。',
      tagSession: '标签',
      editorTitle: '本会话标签',
      editorEmpty: '还没有标签。在下面输入；用 / 表示子标签。',
      loading: '加载中…',
      retry: '重试',
      refresh: '刷新',
      rename: '重命名',
      remove: '删除标签',
      color: '颜色',
      removeConfirm: '删除标签「{name}」及其子标签？会话的其他标签不受影响。',
      confirm: '确认删除',
      newTag: '新标签（用 / 分层）',
      add: '添加',
      save: '保存',
      cancel: '取消',
      untitled: '未命名会话',
      noWorkspace: '无工作区',
      openFailed: '无法打开该会话。',
    };

    function isZh() {
      try {
        const lang = (document.documentElement && document.documentElement.lang) || '';
        const nav = (typeof navigator !== 'undefined' && navigator.language) || '';
        return String(lang || nav).toLowerCase().indexOf('zh') === 0;
      } catch {
        return false;
      }
    }

    function tr(key) {
      const dict = isZh() ? ZH : EN;
      return dict[key] || EN[key] || key;
    }

    // ── state ──────────────────────────────────────────────────────────
    let data = null;
    let loading = false;
    let error = null;
    let collapsed = readCollapsed();
    let sectionCollapsed = readSection();
    let editingTag = null;
    let draft = '';
    let confirmingTag = null;
    let hostEl = null;
    let editorEl = null;
    let cssEl = null;
    let watcher = null;
    let ctxRef = null;
    let refreshSeq = 0;
    const subs = new Set();

    function emit() {
      for (const fn of subs) {
        try {
          fn();
        } catch {
          // ignore a broken subscriber
        }
      }
    }

    function useStore() {
      const pair = React.useState(0);
      const force = pair[1];
      React.useEffect(() => {
        const fn = () => force((v) => v + 1);
        subs.add(fn);
        return () => {
          subs.delete(fn);
        };
      }, []);
      return { data, loading, error, sectionCollapsed };
    }

    function readCollapsed() {
      try {
        const raw = window.localStorage.getItem(LS_COLLAPSED);
        const list = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(list) ? list : []);
      } catch {
        return new Set();
      }
    }

    function writeCollapsed() {
      try {
        window.localStorage.setItem(LS_COLLAPSED, JSON.stringify(Array.from(collapsed)));
      } catch {
        // ignore
      }
    }

    function readSection() {
      try {
        return window.localStorage.getItem(LS_SECTION) === '0';
      } catch {
        return false;
      }
    }

    function writeSection() {
      try {
        window.localStorage.setItem(LS_SECTION, sectionCollapsed ? '0' : '1');
      } catch {
        // ignore
      }
    }

    // ── api ────────────────────────────────────────────────────────────
    async function api(method, body, sessionId) {
      let url = ROUTE;
      if (sessionId) url += '?sessionId=' + encodeURIComponent(sessionId);
      const options = { method, cache: 'no-store' };
      if (body) {
        options.headers = { 'content-type': 'application/json' };
        options.body = JSON.stringify(body);
      }
      const response = await fetch(url, options);
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error('HTTP ' + response.status);
      }
      if (!payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || 'HTTP ' + response.status);
      }
      return payload;
    }

    async function refresh(sessionId) {
      const seq = ++refreshSeq;
      loading = true;
      error = null;
      emit();
      renderSection();
      try {
        const payload = await api('GET', null, sessionId);
        if (seq !== refreshSeq) return;
        data = payload;
      } catch (err) {
        if (seq !== refreshSeq) return;
        error = String((err && err.message) || err);
      }
      loading = false;
      emit();
      renderSection();
    }

    async function mutate(body) {
      error = null;
      try {
        data = await api('POST', body);
        loading = false;
        emit();
        renderSection();
        return true;
      } catch (err) {
        error = String((err && err.message) || err);
        loading = false;
        emit();
        renderSection();
        return false;
      }
    }

    // ── data helpers ───────────────────────────────────────────────────
    function keyOf(name) {
      return String(name).trim().toLocaleLowerCase();
    }

    function nameOf(tag) {
      return tag && typeof tag === 'object' ? tag.name : String(tag || '');
    }

    function colorOf(name) {
      const key = keyOf(name);
      const tag = (data && data.tags ? data.tags : []).find((item) => keyOf(item.name) === key);
      return (tag && tag.color) || FALLBACK_COLOR;
    }

    function tagsOf(sessionId) {
      if (!data || !data.assignments) return [];
      return (data.assignments[sessionId] || []).map((name) => ({ name, color: colorOf(name) }));
    }

    function buildTree(tags) {
      const map = new Map();
      for (const tag of tags || []) {
        map.set(tag.name, { name: tag.name, color: tag.color || FALLBACK_COLOR, count: tag.count || 0, children: [] });
      }
      const roots = [];
      for (const node of map.values()) {
        const at = node.name.lastIndexOf('/');
        const parentName = at > 0 ? node.name.slice(0, at) : '';
        const parent = parentName ? map.get(parentName) : null;
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
      const sort = (list) => {
        list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        for (const node of list) sort(node.children);
      };
      sort(roots);
      return roots;
    }

    function flattenTree(nodes, depth, out) {
      for (const node of nodes) {
        out.push({ node, depth });
        flattenTree(node.children, depth + 1, out);
      }
      return out;
    }

    function totalCount(node) {
      let total = node.count || 0;
      for (const child of node.children) total += totalCount(child);
      return total;
    }

    function labelOf(sessionId) {
      const info = (data && data.sessions && data.sessions[sessionId]) || null;
      if (info && info.title) return info.title;
      const tail = sessionId.length > 10 ? '…' + sessionId.slice(-6) : sessionId;
      if (info && info.workspace) return info.workspace + ' · ' + tail;
      return tr('untitled') + ' · ' + tail;
    }

    function workspaceOf(sessionId) {
      const info = (data && data.sessions && data.sessions[sessionId]) || null;
      return (info && info.workspace) || tr('noWorkspace');
    }

    function openSession(sessionId) {
      try {
        const service = ctxRef && ctxRef.get ? ctxRef.get('uiWorkspace') : null;
        if (service && typeof service.openSession === 'function') {
          service.openSession(sessionId);
          return;
        }
      } catch {
        // fall through
      }
      error = tr('openFailed');
      emit();
      renderSection();
    }

    // ── icons ──────────────────────────────────────────────────────────
    const PATHS = {
      tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8z"/><circle cx="8.2" cy="8.2" r="1.2" fill="currentColor" stroke="none"/>',
      down: '<path d="M6 9l6 6 6-6"/>',
      right: '<path d="M9 6l6 6-6 6"/>',
      pencil: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/>',
      trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
      refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4"/>',
      check: '<path d="M5 12l4 4L19 6"/>',
    };

    function svgMarkup(name, size) {
      return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || PATHS.tag) + '</svg>';
    }

    function icon(name, size) {
      const span = document.createElement('span');
      span.className = 'dst-ico';
      span.innerHTML = svgMarkup(name, size || 14);
      return span;
    }

    function el(tag, attrs, children) {
      const node = document.createElement(tag);
      if (attrs) {
        for (const key of Object.keys(attrs)) {
          const value = attrs[key];
          if (value == null) continue;
          if (key === 'class') node.className = value;
          else if (key === 'text') node.textContent = value;
          else node.setAttribute(key, value);
        }
      }
      for (const child of children || []) {
        if (child == null) continue;
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      }
      return node;
    }

    function dot(color, cls) {
      const span = document.createElement('span');
      span.className = cls || 'dst-dot';
      span.style.background = color || FALLBACK_COLOR;
      return span;
    }

    // ── styles ─────────────────────────────────────────────────────────
    const CSS = [
      '.dst-ico{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}',
      '.dst-inline{display:flex;flex-direction:column;flex:0 0 auto;max-height:46%;border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);background:var(--dsw-specific-sidebar-fill,transparent)}',
      '.dst-inline-head{display:flex;align-items:center;gap:2px;min-height:30px;padding:0 4px}',
      '.dst-inline-toggle{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;height:30px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;text-align:left}',
      '.dst-inline-toggle:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dst-inline-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dst-inline-body{overflow:auto;min-height:0;padding:0 4px 4px}',
      '.dst-inline-hint{padding:10px 8px;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',
      '.dst-inline-error{margin:4px 6px;padding:6px 8px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary);font-size:11.5px;display:flex;gap:8px;align-items:center}',
      '.dst-group{border-radius:8px}',
      '.dst-group:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dst-group-head{display:flex;align-items:center;gap:2px;min-height:28px}',
      '.dst-group-toggle{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;height:28px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;text-align:left}',
      '.dst-tag-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dst-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}',
      '.dst-mini-dot{width:6px;height:6px;border-radius:50%;flex:0 0 auto;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}',
      '.dst-dots{display:inline-flex;align-items:center;gap:2px;padding-left:1px}',
      '.dst-badge{font-size:10.5px;color:var(--dsw-alias-label-secondary);min-width:14px;text-align:right}',
      '.dst-group-actions{display:none;gap:0;padding-right:2px;align-items:center}',
      '.dst-group:hover .dst-group-actions{display:flex}',
      '.dst-color-action{position:relative;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;cursor:pointer}',
      '.dst-color-action:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.dst-color-input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0;margin:0}',
      '.dst-members{padding:0 0 4px 22px}',
      '.dst-member{display:flex;align-items:flex-start;gap:8px;width:100%;padding:4px 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;text-align:left}',
      '.dst-member:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.dst-member-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto}',
      '.dst-member-title{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dst-member-ws{display:block;min-width:0;font-size:10.5px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dst-rename{display:flex;gap:4px;padding:2px 6px 6px 22px}',
      '.dst-input{flex:1 1 auto;min-width:0;height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}',
      '.dst-input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dst-btn{height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;flex:0 0 auto}',
      '.dst-btn:hover{border-color:var(--dsw-alias-brand-primary)}',
      '.dst-btn-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}',
      '.dst-btn-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}',
      '.dst-confirm{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:2px 6px 8px 22px}',
      '.dst-confirm-text{flex:1 1 100%;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
      '.dst-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;flex:0 0 auto}',
      '.dst-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dst-foot{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer;text-align:left}',
      '.dst-foot:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dst-foot-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dst-rowbtn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0}',
      '.dst-rowbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dst-hover-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}',
      '.dst-chip{display:inline-flex;align-items:center;gap:4px;max-width:140px;padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);font-size:10.5px;color:var(--dsw-alias-label-secondary)}',
      '.dst-chip-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dst-pop{position:fixed;width:330px;max-height:64vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.28);z-index:120;color:var(--dsw-alias-label-primary);overflow:hidden}',
      '.dst-pop-head{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:13px;font-weight:600;min-width:0}',
      '.dst-pop-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dst-pop-body{overflow:auto;padding:8px 12px;display:flex;flex-direction:column;gap:2px;min-height:0}',
      '.dst-check{display:flex;align-items:center;gap:8px;padding:4px 2px;font-size:12.5px;border-radius:6px;cursor:pointer}',
      '.dst-check:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dst-check-box{width:15px;height:15px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;color:transparent}',
      '.dst-check-box .dst-ico{display:none}',
      '.dst-check[aria-checked="true"] .dst-check-box{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}',
      '.dst-check[aria-checked="true"] .dst-check-box .dst-ico{display:flex}',
      '.dst-pop-foot{display:flex;gap:6px;align-items:center;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.dst-hint{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.5;padding:2px 0 6px}',
    ].join('\n');

    function ensureCss() {
      if (cssEl && cssEl.isConnected) return;
      cssEl = document.createElement('style');
      cssEl.dataset.dst = 'session-tags';
      cssEl.textContent = CSS;
      document.head.appendChild(cssEl);
    }

    // ── inline section ─────────────────────────────────────────────────
    function ensureHost() {
      const root = document.querySelector(HOST_SELECTOR);
      if (!root) return null;
      if (!hostEl) hostEl = document.createElement('div');
      hostEl.className = 'dst-inline';
      if (hostEl.parentElement !== root) {
        const listArea = root.querySelector(LIST_SELECTOR);
        if (listArea && listArea.parentElement === root) root.insertBefore(hostEl, listArea);
        else root.appendChild(hostEl);
      }
      return hostEl;
    }

    function renderSection() {
      try {
        renderSectionInner();
      } catch (err) {
        try {
          if (!hostEl) return;
          hostEl.textContent = '';
          const row = el('div', { class: 'dst-inline-error' });
          row.textContent = '标签渲染失败: ' + String((err && err.message) || err);
          hostEl.appendChild(row);
        } catch {
          // last resort: keep the sidebar alive
        }
      }
    }

    function renderSectionInner() {
      ensureCss();
      const host = ensureHost();
      if (!host) return;
      host.textContent = '';

      const head = el('div', { class: 'dst-inline-head' });
      const toggle = el('button', {
        class: 'dst-inline-toggle',
        title: tr('title'),
        'aria-label': tr('title'),
        'aria-expanded': sectionCollapsed ? 'false' : 'true',
      });
      toggle.appendChild(icon(sectionCollapsed ? 'right' : 'down', 12));
      toggle.appendChild(el('span', { class: 'dst-inline-title', text: tr('title') }));
      const count = el('span', { class: 'dst-badge' });
      count.textContent = data && Array.isArray(data.tags) ? String(data.tags.length) : '';
      toggle.appendChild(count);
      toggle.addEventListener('click', () => {
        sectionCollapsed = !sectionCollapsed;
        writeSection();
        renderSection();
        emit();
      });
      head.appendChild(toggle);

      const refreshBtn = el('button', { class: 'dst-icon-btn', title: tr('refresh'), 'aria-label': tr('refresh') });
      refreshBtn.appendChild(icon('refresh', 13));
      refreshBtn.addEventListener('click', () => refresh());
      head.appendChild(refreshBtn);
      host.appendChild(head);

      if (sectionCollapsed) return;

      const body = el('div', { class: 'dst-inline-body' });
      host.appendChild(body);

      if (loading && !data) {
        body.appendChild(el('div', { class: 'dst-inline-hint', text: tr('loading') }));
        return;
      }
      if (error) {
        const row = el('div', { class: 'dst-inline-error' });
        row.appendChild(el('span', { text: error }));
        const retry = el('button', { class: 'dst-btn', text: tr('retry') });
        retry.addEventListener('click', () => refresh());
        row.appendChild(retry);
        body.appendChild(row);
        if (!data) return;
      }
      if (!data || !Array.isArray(data.tags) || data.tags.length === 0) {
        body.appendChild(el('div', { class: 'dst-inline-hint', text: tr('inlineEmpty') }));
        return;
      }

      const roots = buildTree(data.tags);
      for (const node of roots) renderNode(body, node, 0);
    }

    function renderNode(parent, node, depth) {
      const group = el('div', { class: 'dst-group' });
      const head = el('div', { class: 'dst-group-head' });
      head.style.paddingLeft = depth * 14 + 'px';
      const open = !collapsed.has(node.name);
      const toggle = el('button', {
        class: 'dst-group-toggle',
        title: node.name,
        'aria-expanded': open ? 'true' : 'false',
      });
      toggle.appendChild(icon(open ? 'down' : 'right', 12));
      toggle.appendChild(el('span', { class: 'dst-tag-name', text: node.name.split('/').pop() }));
      toggle.appendChild(dot(node.color));
      const badge = el('span', { class: 'dst-badge' });
      badge.textContent = String(totalCount(node));
      toggle.appendChild(badge);
      toggle.addEventListener('click', () => {
        if (collapsed.has(node.name)) collapsed.delete(node.name);
        else collapsed.add(node.name);
        writeCollapsed();
        renderSection();
      });
      head.appendChild(toggle);

      const actions = el('div', { class: 'dst-group-actions' });

      const colorLabel = el('label', { class: 'dst-color-action', title: tr('color'), 'aria-label': tr('color') });
      const colorInput = el('input', { type: 'color', value: node.color || FALLBACK_COLOR, class: 'dst-color-input' });
      const colorSwatch = dot(node.color, 'dst-dot');
      colorLabel.appendChild(colorInput);
      colorLabel.appendChild(colorSwatch);
      colorInput.addEventListener('change', () => {
        const value = String(colorInput.value || '').toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(value)) mutate({ op: 'setTagColor', tag: node.name, color: value });
      });
      actions.appendChild(colorLabel);

      const renameBtn = el('button', { class: 'dst-icon-btn', title: tr('rename'), 'aria-label': tr('rename') });
      renameBtn.appendChild(icon('pencil', 12));
      renameBtn.addEventListener('click', () => {
        editingTag = node.name;
        draft = node.name;
        confirmingTag = null;
        renderSection();
      });
      actions.appendChild(renameBtn);

      const removeBtn = el('button', { class: 'dst-icon-btn', title: tr('remove'), 'aria-label': tr('remove') });
      removeBtn.appendChild(icon('trash', 12));
      removeBtn.addEventListener('click', () => {
        editingTag = null;
        confirmingTag = node.name;
        renderSection();
      });
      actions.appendChild(removeBtn);
      head.appendChild(actions);
      group.appendChild(head);

      if (editingTag === node.name) group.appendChild(renameRow(node.name));
      if (confirmingTag === node.name) group.appendChild(confirmRow(node.name));

      if (open) {
        for (const child of node.children) {
          group.appendChild(renderNodeGroup(child, depth + 1));
        }
        const ids = membersOf(node.name);
        if (ids.length) {
          const members = el('div', { class: 'dst-members' });
          members.style.paddingLeft = depth * 14 + 22 + 'px';
          for (const sessionId of ids) {
            const row = el('button', { class: 'dst-member', title: labelOf(sessionId) });
            const main = el('span', { class: 'dst-member-main' });
            main.appendChild(el('span', { class: 'dst-member-title', text: labelOf(sessionId) }));
            main.appendChild(el('span', { class: 'dst-member-ws', text: workspaceOf(sessionId) }));
            row.appendChild(main);
            row.addEventListener('click', () => openSession(sessionId));
            members.appendChild(row);
          }
          group.appendChild(members);
        }
      }
      parent.appendChild(group);
      return group;
    }

    function renderNodeGroup(node, depth) {
      const wrap = el('div');
      renderNode(wrap, node, depth);
      return wrap;
    }

    function membersOf(tagName) {
      if (!data || !data.assignments) return [];
      const key = keyOf(tagName);
      const out = [];
      for (const sessionId of Object.keys(data.assignments)) {
        const tags = data.assignments[sessionId] || [];
        if (tags.some((tag) => keyOf(nameOf(tag)) === key)) out.push(sessionId);
      }
      out.sort((a, b) => labelOf(a).localeCompare(labelOf(b), 'zh'));
      return out;
    }

    function renameRow(tagName) {
      const form = el('form', { class: 'dst-rename' });
      const input = el('input', { class: 'dst-input', value: draft });
      input.value = draft;
      input.addEventListener('input', () => {
        draft = input.value;
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          editingTag = null;
          renderSection();
        }
      });
      const save = el('button', { class: 'dst-btn dst-btn-primary', type: 'submit', text: tr('save') });
      const cancel = el('button', { class: 'dst-btn', type: 'button', text: tr('cancel') });
      cancel.addEventListener('click', () => {
        editingTag = null;
        renderSection();
      });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = draft.trim();
        editingTag = null;
        if (!value || value === tagName) {
          renderSection();
          return;
        }
        mutate({ op: 'renameTag', from: tagName, to: value });
      });
      form.appendChild(input);
      form.appendChild(save);
      form.appendChild(cancel);
      setTimeout(() => {
        try {
          input.focus();
          input.select();
        } catch {
          // ignore
        }
      }, 0);
      return form;
    }

    function confirmRow(tagName) {
      const row = el('div', { class: 'dst-confirm' });
      row.appendChild(el('span', { class: 'dst-confirm-text', text: tr('removeConfirm').replace('{name}', tagName) }));
      const yes = el('button', { class: 'dst-btn dst-btn-danger', type: 'button', text: tr('confirm') });
      yes.addEventListener('click', () => {
        confirmingTag = null;
        mutate({ op: 'deleteTag', tag: tagName });
      });
      const no = el('button', { class: 'dst-btn', type: 'button', text: tr('cancel') });
      no.addEventListener('click', () => {
        confirmingTag = null;
        renderSection();
      });
      row.appendChild(yes);
      row.appendChild(no);
      return row;
    }

    // ── tag editor popover ─────────────────────────────────────────────
    function closeEditor() {
      if (!editorEl) return;
      const cleanup = editorEl.__dstCleanup;
      if (typeof cleanup === 'function') cleanup();
      editorEl.remove();
      editorEl = null;
    }

    async function openEditor(sessionId, anchor) {
      closeEditor();
      await refresh(sessionId);
      if (!data || !sessionId) return;
      const assigned = (data.assignments && data.assignments[sessionId]) || [];
      const selection = new Set(assigned.map((name) => keyOf(nameOf(name))));
      const tree = buildTree(data.tags || []);
      const flat = flattenTree(tree, 0, []);

      const pop = el('div', { class: 'dst-pop', role: 'dialog', 'aria-label': tr('editorTitle') });
      const head = el('div', { class: 'dst-pop-head' });
      head.appendChild(icon('tag', 14));
      head.appendChild(el('span', { class: 'dst-pop-title', text: tr('editorTitle') }));
      pop.appendChild(head);

      const body = el('div', { class: 'dst-pop-body' });
      pop.appendChild(body);
      const hint = el('div', { class: 'dst-hint', text: flat.length ? '' : tr('editorEmpty') });
      body.appendChild(hint);

      function addCheck(name, color, depth) {
        const key = keyOf(name);
        const row = el('div', {
          class: 'dst-check',
          role: 'checkbox',
          tabindex: '0',
          'aria-checked': selection.has(key) ? 'true' : 'false',
        });
        row.style.paddingLeft = 2 + depth * 14 + 'px';
        const box = el('span', { class: 'dst-check-box' });
        box.appendChild(icon('check', 11));
        row.appendChild(box);
        row.appendChild(dot(color));
        row.appendChild(el('span', { class: 'dst-tag-name', text: name }));
        const toggle = () => {
          if (selection.has(key)) selection.delete(key);
          else selection.add(key);
          row.setAttribute('aria-checked', selection.has(key) ? 'true' : 'false');
        };
        row.addEventListener('click', toggle);
        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        });
        body.appendChild(row);
      }

      for (const item of flat) addCheck(item.node.name, item.node.color, item.depth);

      const footer = el('div', { class: 'dst-pop-foot' });
      const input = el('input', { class: 'dst-input', placeholder: tr('newTag') });
      const add = el('button', { class: 'dst-btn', type: 'button', text: tr('add') });
      const save = el('button', { class: 'dst-btn dst-btn-primary', type: 'button', text: tr('save') });
      const cancel = el('button', { class: 'dst-btn', type: 'button', text: tr('cancel') });
      footer.appendChild(input);
      footer.appendChild(add);
      footer.appendChild(save);
      footer.appendChild(cancel);
      pop.appendChild(footer);

      function addNew() {
        const value = input.value.trim();
        if (!value) return;
        const key = keyOf(value.replace(/\s*\/\s*/g, '/'));
        if (!selection.has(key)) {
          selection.add(key);
          addCheck(value.replace(/\s*\/\s*/g, '/'), FALLBACK_COLOR, Math.min(value.split('/').length - 1, 5));
        }
        input.value = '';
        input.focus();
      }

      add.addEventListener('click', addNew);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          addNew();
        }
      });
      save.addEventListener('click', async () => {
        const names = [];
        for (const key of selection) {
          const found = flat.find((item) => keyOf(item.node.name) === key);
          names.push(found ? found.node.name : key);
        }
        const ok = await mutate({ op: 'setSessionTags', sessionId, tags: names });
        if (ok) closeEditor();
      });
      cancel.addEventListener('click', closeEditor);

      document.body.appendChild(pop);
      const rect = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
      if (rect) {
        const width = 330;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        let top = rect.bottom + 6;
        if (top + 380 > window.innerHeight) top = Math.max(8, rect.top - 386);
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
      } else {
        pop.style.left = '24px';
        pop.style.top = '72px';
      }

      const onOutside = (event) => {
        if (pop.contains(event.target)) return;
        if (anchor && anchor.contains && anchor.contains(event.target)) return;
        closeEditor();
      };
      const onKey = (event) => {
        if (event.key === 'Escape') closeEditor();
      };
      setTimeout(() => document.addEventListener('mousedown', onOutside), 0);
      document.addEventListener('keydown', onKey);
      pop.__dstCleanup = () => {
        document.removeEventListener('mousedown', onOutside);
        document.removeEventListener('keydown', onKey);
      };
      editorEl = pop;
    }

    // ── react entry points ─────────────────────────────────────────────
    function ReactIcon(props) {
      const name = props.name || 'tag';
      const size = props.size || 14;
      return h('span', { className: 'dst-ico', dangerouslySetInnerHTML: { __html: svgMarkup(name, size) } });
    }

    function FooterEntry(props) {
      const current = useStore();
      const wide = props.wide !== false;
      return h('button', {
        className: 'dst-foot',
        title: tr('entry'),
        'aria-label': tr('entry'),
        'aria-expanded': current.sectionCollapsed ? 'false' : 'true',
        onClick: () => {
          sectionCollapsed = !sectionCollapsed;
          writeSection();
          if (!sectionCollapsed) refresh();
          renderSection();
          emit();
        },
      }, h(ReactIcon, { name: 'tag' }), wide ? h('span', { className: 'dst-foot-label' }, tr('entry')) : null);
    }

    function RowTagButton(props) {
      return h('button', {
        className: 'dst-rowbtn',
        title: tr('tagSession'),
        'aria-label': tr('tagSession'),
        onClick: (event) => {
          event.stopPropagation();
          openEditor(props.sessionId, event.currentTarget);
        },
      }, h(ReactIcon, { name: 'tag', size: 14 }));
    }

    function HeaderTagButton(props) {
      return h('button', {
        className: 'dst-icon-btn',
        title: tr('editorTitle'),
        'aria-label': tr('editorTitle'),
        onClick: (event) => {
          event.stopPropagation();
          openEditor(props.sessionId, event.currentTarget);
        },
      }, h(ReactIcon, { name: 'tag', size: 15 }));
    }

    function RowLeading(props) {
      useStore();
      const tags = tagsOf(props.sessionId);
      if (!tags.length) return null;
      return h('span', { className: 'dst-dots', title: tags.map((tag) => tag.name).join(' · ') },
        tags.slice(0, 3).map((tag, index) => h('span', { key: index, className: 'dst-mini-dot', style: { background: tag.color } })),
      );
    }

    function RowHover(props) {
      useStore();
      const tags = tagsOf(props.sessionId);
      if (!tags.length) return null;
      return h('div', { className: 'dst-hover-tags' },
        tags.slice(0, 6).map((tag, index) => h('span', { key: index, className: 'dst-chip', title: tag.name },
          h('span', { className: 'dst-dot', style: { background: tag.color, width: 7, height: 7 } }),
          h('span', { className: 'dst-chip-name' }, tag.name),
        )),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctxRef = ctx;
        ensureCss();
        refresh();
        renderSection();
        if (!watcher) {
          watcher = setInterval(() => {
            if (!hostEl || !hostEl.isConnected || hostEl.childElementCount === 0) renderSection();
            else if (!data && !loading) refresh();
          }, 1500);
        }

        const put = (slot, order, component) => {
          try {
            ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, id: 'session-tags', order }, component));
          } catch {
            // A host build without this slot must not take the others down.
          }
        };
        put('sidebar.footer.action', 50, FooterEntry);
        put('sidebar.workspaces.session.row.action', 300, RowTagButton);
        put('sidebar.session.row.leading', 50, RowLeading);
        put('sidebar.session.row.hover', 50, RowHover);
        put('conversation.session.header.actions', 30, HeaderTagButton);

        ctx.effect(() => () => {
          if (watcher) clearInterval(watcher);
          watcher = null;
          closeEditor();
          if (hostEl && hostEl.parentElement) hostEl.remove();
          hostEl = null;
          if (cssEl && cssEl.parentElement) cssEl.remove();
          cssEl = null;
        });
      },
    };
  },
});
