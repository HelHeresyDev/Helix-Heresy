(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixAccessibilityUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CONTROLS = 'button,input,select,textarea,a[href],summary,[tabindex],[contenteditable="true"]';
  const visible = e => Boolean(e?.isConnected && !e.closest('[hidden],[inert],.hidden') && e.getClientRects().length);
  const focusable = e => visible(e) && !e.disabled && e.tabIndex >= 0;
  const kebab = s => s.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
  function tabIndex(index, length, key) {
    if (!length) return -1;
    if (key === 'Home') return 0;
    if (key === 'End') return length - 1;
    return (index + (['ArrowLeft', 'ArrowUp'].includes(key) ? -1 : 1) + length) % length;
  }
  function key(e) {
    if (e.id) return `#${e.id}`;
    const data = Object.entries(e.dataset).filter(([k]) => !/^(hotkey|disabledReason|baseStamina|finalStamina|staminaCost|mapViewport[XYZWH]|mapEffect|mapLighting|mapKnowledge)/.test(k));
    // A map viewport remains the same focus target when its coordinates move.
    if (e.hasAttribute('data-map-viewport')) return `viewport:${e.dataset.mapRenderer}`;
    return JSON.stringify([e.tagName, e.getAttribute('type'), e.getAttribute('name'), data.sort(),
      data.length || !e.matches('button,a[href],summary,label,[role="button"]') ? '' : e.textContent.trim().replace(/\s+/g, ' ')]);
  }
  function path(e, scope) {
    const result = [];
    while (e && e !== scope) { result.push(key(e)); e = e.parentElement; }
    return JSON.stringify(result);
  }
  function captureFocus(doc) {
    const e = doc.activeElement;
    if (!e || e === doc.body || !visible(e)) return null;
    const scope = e.closest('[data-workspace-panel],.setup-card,.topbar,.workspace-tabs') || doc.body;
    let selection = null;
    try { if (e.selectionStart != null) selection = [e.selectionStart, e.selectionEnd, e.selectionDirection]; } catch {}
    return { element: e, scope, id: e.id, viewport: e.hasAttribute('data-map-viewport') ? e.dataset.mapRenderer : null, path: path(e, scope), selection,
      value: e.matches('textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"])') ? e.value : null };
  }
  function restoreFocus(doc, saved) {
    if (!saved || !visible(saved.scope) || doc.activeElement !== saved.element && doc.activeElement !== doc.body && doc.activeElement?.isConnected) return;
    const matches = saved.id ? [doc.getElementById(saved.id)] : saved.viewport ? [...saved.scope.querySelectorAll(`[data-map-viewport][data-map-renderer="${saved.viewport}"]`)]
      : [...saved.scope.querySelectorAll(CONTROLS)].filter(e => path(e, saved.scope) === saved.path);
    const e = matches.length === 1 ? matches[0] : null;
    if (e && visible(e) && !e.disabled) {
      if (saved.value != null) e.value = saved.value;
      e.focus({ preventScroll: true });
      if (saved.selection) try { e.setSelectionRange(...saved.selection); } catch {}
    } else if (doc.activeElement === doc.body) {
      // A removed person/order must not hand focus to a different same-named
      // entity. Return to the current region heading, not an unrelated action.
      const heading = saved.scope.querySelector('[data-map-viewport]') || [...saved.scope.querySelectorAll('h2,h3')].find(visible);
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
  }
  function preserveFocus(doc, work) {
    const saved = captureFocus(doc);
    try { return work(); } finally { restoreFocus(doc, saved); }
  }
  function linkTabs(doc) {
    for (const list of doc.querySelectorAll('[role="tablist"]')) {
      const scope = list.closest('[data-workspace-panel],.selection-inspector') || doc;
      for (const button of list.querySelectorAll('[role="tab"]')) {
        const entry = Object.entries(button.dataset).find(([k]) => k.endsWith('Tab'));
        if (!entry) continue;
        const [type, value] = entry, panelType = `${type.slice(0, -3)}Panel`;
        const panel = [...scope.querySelectorAll(`[data-${kebab(panelType)}]`)].find(p => p.dataset[panelType] === value);
        if (!panel) continue;
        button.id ||= `a11y-tab-${type}-${value}`;
        panel.id ||= `a11y-panel-${panelType}-${value}`;
        button.setAttribute('aria-controls', panel.id); panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', button.id);
      }
    }
  }
  function handleTabKey(event) {
    const button = event.target.closest?.('[role="tab"]'), list = button?.closest('[role="tablist"]');
    if (!list || event.altKey || event.ctrlKey || event.metaKey) return false;
    const keys = list.getAttribute('aria-orientation') === 'vertical' ? ['ArrowUp', 'ArrowDown', 'Home', 'End'] : ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return false;
    const tabs = [...list.querySelectorAll('[role="tab"]')].filter(t => visible(t) && !t.disabled);
    const next = tabs[tabIndex(tabs.indexOf(button), tabs.length, event.key)];
    if (!next) return false;
    event.preventDefault(); event.stopPropagation();
    // Click uses the existing tab controller; it must not execute game work.
    next.click(); (next.isConnected ? next : event.target.ownerDocument.getElementById(next.id))?.focus({ preventScroll: true });
    return true;
  }
  function trapFocus(event, container) {
    if (event.key !== 'Tab' || !visible(container)) return false;
    const items = [...container.querySelectorAll(CONTROLS)].filter(focusable);
    const first = items[0], last = items.at(-1), active = container.ownerDocument.activeElement;
    if (!first) { container.tabIndex = -1; container.focus(); event.preventDefault(); return true; }
    if (!container.contains(active) || event.shiftKey && (active === first || active.tabIndex < 0) || !event.shiftKey && active === last) {
      event.preventDefault(); (event.shiftKey ? last : first).focus(); return true;
    }
    return false;
  }
  function nativeKey(target, key) {
    return Boolean(target.closest?.('button,a[href],summary,[role="tab"],[role="button"]')
      && ['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key));
  }
  function contrast(a, b) {
    const lum = hex => {
      const v = hex.replace('#', '');
      const values = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
      return values.reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    };
    const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  return { visible, focusable, tabIndex, captureFocus, restoreFocus, preserveFocus, linkTabs, handleTabKey, trapFocus, nativeKey, contrast };
});
