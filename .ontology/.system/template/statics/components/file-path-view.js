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
    for (const n of this.sorted(nodes)) {
      const li = document.createElement('li');
      // Class(또는 노드 없는 폴더) = 접고 펼치는 폴더. 파일(Concept·Instance)은 한 줄.
      if (n.node && n.node.type !== 'Class') {
        li.appendChild(this.fileRow(n.node, n.name));
        if (n.children.length) li.appendChild(this.buildList(n.children));
      } else {
        li.appendChild(this.folderItem(n.node, n.name, n.children));
      }
      ul.appendChild(li);
    }
    return ul;
  }

  // Concept(루트 .md)를 맨 위로, 나머지(Class 폴더·Instance)는 이름순.
  sorted(nodes) {
    return [...nodes].sort((a, b) => {
      const rank = (n) => (n.node?.type === 'Concept' ? 0 : 1);
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    });
  }

  // Class = 폴더. <details>로 열고 닫되 토글은 📁 아이콘만, 이름 클릭은 Class 노드 본문으로 이동.
  folderItem(node, name, children) {
    const details = document.createElement('details');
    details.open = true;

    const summary = document.createElement('summary');
    summary.className = 'row folder';

    const toggle = document.createElement('span'); // 아이콘(📁/📂)은 CSS ::before가 그림
    toggle.className = 'folder-toggle';
    const label = document.createElement('span');
    label.className = 'folder-name';
    // Concept·Instance처럼 종류 뱃지(Class)를 보이게 + 폴더명.
    label.innerHTML = `${node ? badge(node.type) : ''}${esc(name)}`;
    summary.append(toggle, label);

    // 네이티브 토글은 막고: 아이콘 클릭=열고닫기, 그 외(이름)=Class 노드 본문 열기.
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (e.target.closest('.folder-toggle')) details.open = !details.open;
      else if (node) requestOpenNode(this, node.id);
    });

    details.appendChild(summary);
    if (children.length) details.appendChild(this.buildList(children));
    return details;
  }

  // Concept·Instance = 파일. 종류(badge) + 제목(label) + 파일명 모두 보이게.
  fileRow(node, name) {
    const span = document.createElement('span');
    span.className = 'row node';
    span.innerHTML = `${badge(node.type)}${esc(node.label)} <span class="fname">${esc(name)}.md</span>`;
    span.onclick = () => requestOpenNode(this, node.id);
    return span;
  }
}

customElements.define('file-path-view', FilePathView);
