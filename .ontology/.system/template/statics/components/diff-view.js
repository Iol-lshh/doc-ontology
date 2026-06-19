// <diff-view> — 스냅샷 비교 (DiffFacade, ADR 0012).
// from/to 선택자(세대·current·backup) → /diff 호출 → 그래프 diff(먼저) + 파일 diff(드릴다운).

import { api } from '../api.js';
import { esc, placeholder, badge } from '../dom.js';

class DiffView extends HTMLElement {
  connectedCallback() {
    this.load();
  }

  // 선택자 옵션 = current + backup + 세대들(과거→최신). load()는 탭 진입 시 옵션 갱신.
  async load() {
    const hist = await api.history();
    const gens = hist.enabled ? hist.generations : [];
    const options = [
      { value: 'backup', text: '직전 여벌(backup)' },
      { value: 'current', text: '현재(current)' },
      ...gens.map((g, i) => ({
        value: g.generation,
        text: `#${i + 1} ${g.ts ? new Date(g.ts).toLocaleString() : ''} (${g.generation.slice(0, 8)})`,
      })),
    ];
    const opt = (sel) => options.map((o) => `<option value="${esc(o.value)}"${o.value === sel ? ' selected' : ''}>${esc(o.text)}</option>`).join('');
    // 기본: backup → current (마지막 빌드 변경). 세대가 2개 이상이면 최신 두 세대.
    let from = 'backup', to = 'current';
    if (gens.length >= 2) { from = gens[gens.length - 2].generation; to = gens[gens.length - 1].generation; }

    this.innerHTML = `
      <div class="diff-bar">
        <select class="diff-from">${opt(from)}</select>
        <span class="diff-arrow">→</span>
        <select class="diff-to">${opt(to)}</select>
        <button class="diff-run">비교</button>
      </div>
      <div class="diff-result"></div>`;

    this.querySelector('.diff-run').onclick = () => this.run();
    this.run();
  }

  async run() {
    const from = this.querySelector('.diff-from').value;
    const to = this.querySelector('.diff-to').value;
    const result = this.querySelector('.diff-result');
    const data = await api.diff(from, to);
    if (!data.ok) {
      result.innerHTML = placeholder(data.error);
      return;
    }
    result.innerHTML = this.renderDiff(data);
  }

  renderDiff(d) {
    const g = d.graph;
    const total = g.nodes.added.length + g.nodes.removed.length + g.nodes.changed.length + g.edges.added.length + g.edges.removed.length;
    if (total === 0) return placeholder('두 스냅샷이 동일합니다.');

    const nodeLine = (sign, cls, n) => `<div class="d-${cls}">${sign} ${badge(n.type ?? n.to?.type)}${esc(n.label ?? n.to?.label)}</div>`;
    const edgeLine = (sign, cls, e) => `<div class="d-${cls}">${sign} <span class="rel">${esc(e.rel)}</span> ${esc(e.from.slice(0, 8))}→${esc(e.to.slice(0, 8))}</div>`;

    let html = '<h3>그래프</h3><div class="edge-list">';
    g.nodes.added.forEach((n) => (html += nodeLine('+', 'add', n)));
    g.nodes.removed.forEach((n) => (html += nodeLine('−', 'del', n)));
    g.nodes.changed.forEach((n) => (html += nodeLine('~', 'mod', n)));
    g.edges.added.forEach((e) => (html += edgeLine('+', 'add', e)));
    g.edges.removed.forEach((e) => (html += edgeLine('−', 'del', e)));
    html += '</div>';

    const f = d.files;
    if (f.added.length + f.removed.length + f.modified.length) {
      html += '<h3>파일</h3><div class="edge-list">';
      f.added.forEach((p) => (html += `<div class="d-add">+ ${esc(p)}</div>`));
      f.removed.forEach((p) => (html += `<div class="d-del">− ${esc(p)}</div>`));
      f.modified.forEach((p) => (html += `<div class="d-mod">~ ${esc(p)}</div>`));
      html += '</div>';
    }
    return html;
  }
}

customElements.define('diff-view', DiffView);
