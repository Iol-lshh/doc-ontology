// <graph-view> — 관계 그래프 (FindGraphFacade).
// graphIndex의 edges를 'A --rel--> B' 목록으로 렌더.

import { api } from '../api.js';
import { esc, placeholder } from '../dom.js';

class GraphView extends HTMLElement {
  connectedCallback() {
    this.load();
  }

  async load() {
    const data = await api.graph();
    if (!data.ok) {
      this.innerHTML = placeholder(data.error);
      return;
    }
    const label = (id) => data.nodes[id]?.label ?? id;
    const wrap = document.createElement('div');
    wrap.className = 'edge-list';
    for (const e of data.edges) {
      const div = document.createElement('div');
      div.innerHTML = `${esc(label(e.from))} <span class="rel">--${esc(e.rel)}--&gt;</span> ${esc(label(e.to))}`;
      wrap.appendChild(div);
    }
    this.replaceChildren(wrap);
  }
}

customElements.define('graph-view', GraphView);
