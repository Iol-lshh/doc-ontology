// <document-view> — 노드 본문 (FindDocumentFacade).
// 다른 뷰와 달리 자동 로드하지 않는다. open(id)로 외부(노드 클릭)에서 호출될 때 로드한다.

import { api } from '../api.js';
import { esc, placeholder, badge } from '../dom.js';

class DocumentView extends HTMLElement {
  connectedCallback() {
    if (!this.innerHTML.trim()) {
      this.innerHTML = placeholder('구조도·그래프에서 노드를 클릭하면 본문이 열립니다.');
    }
  }

  async open(id) {
    const data = await api.document(id);
    if (!data.ok) {
      this.innerHTML = placeholder(data.error);
      return;
    }
    this.innerHTML = `<div class="doc"><h2>${badge(data.type)}${esc(data.label)}</h2>${esc(data.content)}</div>`;
  }
}

customElements.define('document-view', DocumentView);
