// 컴포넌트 공용 DOM 유틸.

export const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export const placeholder = (msg) => `<div class="placeholder">${esc(msg)}</div>`;

export const badge = (type) => `<span class="badge ${type}">${type}</span>`;

// 노드를 본문으로 열라는 요청. app.js가 받아 document 탭으로 전환한다(컴포넌트 간 통신).
export function requestOpenNode(el, id) {
  el.dispatchEvent(new CustomEvent('node-open', { detail: { id }, bubbles: true, composed: true }));
}
