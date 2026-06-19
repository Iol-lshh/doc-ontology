// <file-path-view> — 파일 구조도 (FindFilePathFacade).
// fileIndex 트리를 렌더. 노드 클릭 시 node-open 이벤트로 본문 열기 요청.

import { api } from '../api.js';
import { esc, placeholder, badge, requestOpenNode } from '../dom.js';

class FilePathView extends HTMLElement {
  connectedCallback() {
    this.load();
  }

  async load() {
    const data = await api.filePath();
    if (!data.ok) {
      this.innerHTML = placeholder(data.error);
      return;
    }
    const root = this.buildList(data.tree);
    root.className = 'tree';
    this.replaceChildren(root);
  }

  buildList(nodes) {
    const ul = document.createElement('ul');
    for (const n of nodes) {
      const li = document.createElement('li');
      if (n.node) li.appendChild(this.nodeRow(n.node));
      else {
        const d = document.createElement('span');
        d.className = 'row dir';
        d.textContent = '📁 ' + n.name;
        li.appendChild(d);
      }
      if (n.children.length) li.appendChild(this.buildList(n.children));
      ul.appendChild(li);
    }
    return ul;
  }

  nodeRow(node) {
    const span = document.createElement('span');
    span.className = 'row node';
    span.innerHTML = `${badge(node.type)}${esc(node.label)}`;
    span.onclick = () => requestOpenNode(this, node.id);
    return span;
  }
}

customElements.define('file-path-view', FilePathView);
