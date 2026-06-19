// <history-view> — 세대 히스토리 (FindHistoryFacade).
// 세대 목록을 시각(브라우저 로컬 포맷)·노드수와 함께 렌더.

import { api } from '../api.js';
import { esc, placeholder } from '../dom.js';

class HistoryView extends HTMLElement {
  connectedCallback() {
    this.load();
  }

  async load() {
    const data = await api.history();
    if (!data.enabled) {
      this.innerHTML = placeholder('히스토리 꺼짐 (config history.enabled=false)');
      return;
    }
    if (!data.generations.length) {
      this.innerHTML = placeholder('아직 세대 없음 — 빌드하면 적재됩니다.');
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'gen-list';
    data.generations.forEach((g, i) => {
      const div = document.createElement('div');
      div.className = 'gen';
      const when = g.ts ? new Date(g.ts).toLocaleString() : '';
      div.innerHTML = `<span class="gen-no">#${i + 1}</span> <span class="gen-time">${esc(when)}</span> <span class="gen-id">${esc(g.generation)}</span> <span class="gen-meta">노드 ${g.nodeCount}</span>`;
      wrap.appendChild(div);
    });
    this.replaceChildren(wrap);
  }
}

customElements.define('history-view', HistoryView);
