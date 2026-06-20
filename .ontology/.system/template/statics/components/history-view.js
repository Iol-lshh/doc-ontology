// <history-view> — 세대 히스토리 (FindHistoryFacade).
// 세대 목록을 시각(브라우저 로컬 포맷)·노드수와 함께 렌더. 현재 HEAD 표시 + 세대별 '체크' 버튼.

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
      div.className = 'gen' + (g.isHead ? ' head' : '');
      const when = g.ts ? new Date(g.ts).toLocaleString() : '';
      const head = g.isHead ? '<span class="gen-head">HEAD</span>' : '';
      div.innerHTML = `<span class="gen-no">#${i + 1}</span> <span class="gen-time">${esc(when)}</span> <span class="gen-id">${esc(g.generation)}</span> <span class="gen-meta">노드 ${g.nodeCount}</span>${head}`;
      // 체크: 그 세대로 작업본+유저 DB를 옮긴다(HEAD 이동). HEAD인 세대엔 버튼 숨김.
      if (!g.isHead) {
        const btn = document.createElement('button');
        btn.className = 'gen-checkout';
        btn.textContent = '체크';
        btn.onclick = () => this.checkout(g.generation);
        div.appendChild(btn);
      }
      wrap.appendChild(div);
    });
    this.replaceChildren(wrap);
  }

  async checkout(generation) {
    const data = await api.checkout(generation);
    document.getElementById('log').textContent = data.ok
      ? `체크 — HEAD를 ${generation.slice(0, 12)}로 (끝 버리려면 리셋)`
      : `체크 실패: ${data.error}`;
    if (data.ok) this.load(); // HEAD 표식 갱신
  }
}

customElements.define('history-view', HistoryView);
