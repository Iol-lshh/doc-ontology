// <document-view> — 노드 본문 (FindDocumentFacade).
// 다른 뷰와 달리 자동 로드하지 않는다. open(id)로 외부(노드 클릭)에서 열린다.
// 연 id를 기억했다가, 빌드·체크 등으로 작업본이 바뀐 뒤 탭 재진입(load) 때 다시 가져온다.

import { api } from '../api.js';
import { esc, placeholder, badge } from '../dom.js';

class DocumentView extends HTMLElement {
  connectedCallback() {
    if (!this.innerHTML.trim()) {
      this.innerHTML = placeholder('구조도·그래프에서 노드를 클릭하면 본문이 열립니다.');
    }
  }

  // 노드 클릭 → 그 id를 열고 기억한다.
  open(id) {
    this.currentId = id;
    return this.load();
  }

  // 열린 id가 있으면 현재 작업본 기준으로 다시 가져온다(체크·빌드 후 따라가도록).
  async load() {
    if (!this.currentId) return; // 아직 연 노드 없음 — 안내 유지
    const data = await api.document(this.currentId);
    if (!data.ok) {
      this.innerHTML = placeholder(data.error);
      return;
    }
    this.innerHTML = `<div class="doc"><h2>${badge(data.type)}${esc(data.label)}</h2>${esc(data.content)}</div>`;
  }
}

customElements.define('document-view', DocumentView);
