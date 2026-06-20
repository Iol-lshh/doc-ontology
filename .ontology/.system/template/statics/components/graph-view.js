// <graph-view> — 온톨로지 계층: Concept > Class(상속) > Instance.
// 최상위는 Concept(본체). 펼치면 하위 개념(narrower) + 관련 인스턴스를 소속 Class로 묶는다.
// Class는 폴더 상속(broader/narrower)대로 중첩되고(예: reason > distil), 그 안에 인스턴스(leaf)가 온다.
// ▸/▾ 화살표=접고 펼치기, 라벨 클릭=본문 열기, (n)=자식 수.

import { api } from '../api.js';
import { esc, placeholder, badge, requestOpenNode } from '../dom.js';

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
    this.nodes = data.nodes;
    this.out = {}; // from → [edge]
    for (const e of data.edges) (this.out[e.from] ||= []).push(e);

    let roots = Object.keys(this.nodes).filter((id) => this.nodes[id].type === 'Concept');
    if (!roots.length) roots = Object.keys(this.nodes); // Concept 없으면 전체 폴백
    roots.sort(this.byLabel);

    const ul = document.createElement('ul');
    ul.className = 'tree';
    for (const id of roots) ul.appendChild(this.conceptItem(id));
    this.replaceChildren(ul);
  }

  byLabel = (a, b) => this.nodes[a].label.localeCompare(this.nodes[b].label);

  outRel(id, rel) {
    return (this.out[id] || []).filter((e) => e.rel === rel);
  }

  // 인스턴스의 직접 소속 Class(class 엣지).
  classOf(id) {
    const e = (this.out[id] || []).find((x) => x.rel === 'class');
    return e ? e.to : null;
  }

  // Class의 상위 Class(폴더 상속 = broader → Class).
  classParent(id) {
    const e = (this.out[id] || []).find((x) => x.rel === 'broader' && this.nodes[x.to]?.type === 'Class');
    return e ? e.to : null;
  }

  // [type] label 한 조각 — 클릭하면 본문 열기.
  openLabel(id) {
    const s = document.createElement('span');
    s.className = 'gopen';
    s.innerHTML = `${badge(this.nodes[id].type)}${esc(this.nodes[id].label)}`;
    s.onclick = () => requestOpenNode(this, id);
    return s;
  }

  // 펼치는 노드: ▸ [type] label (n). 자식은 첫 펼침에 childrenFn(ul)로 생성(지연).
  expandable(id, count, childrenFn) {
    const li = document.createElement('li');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.className = 'row node';
    const arrow = document.createElement('span');
    arrow.className = 'gtoggle';
    const c = document.createElement('span');
    c.className = 'gcount';
    c.textContent = count;
    summary.append(arrow, this.openLabel(id), c);
    details.appendChild(summary);

    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (!e.target.closest('.gopen')) details.open = !details.open;
    });

    let built = false;
    details.addEventListener('toggle', () => {
      if (details.open && !built) {
        built = true;
        const ul = document.createElement('ul');
        childrenFn(ul);
        details.appendChild(ul);
      }
    });

    li.appendChild(details);
    return li;
  }

  leaf(id) {
    const li = document.createElement('li');
    const row = document.createElement('span');
    row.className = 'row node';
    row.appendChild(this.openLabel(id));
    li.appendChild(row);
    return li;
  }

  // Concept > (하위 개념 narrower) + (관련 인스턴스를 Class 상속 트리로 묶음).
  conceptItem(id) {
    const narrower = this.outRel(id, 'narrower').filter((e) => this.nodes[e.to].type === 'Concept');
    const insts = this.outRel(id, 'isAboutOf').filter((e) => this.nodes[e.to].type === 'Instance');

    // 인스턴스를 직접 소속 Class로 묶는다.
    const instByClass = new Map();
    const classless = [];
    for (const e of insts) {
      const cid = this.classOf(e.to);
      if (cid) (instByClass.get(cid) || instByClass.set(cid, []).get(cid)).push(e.to);
      else classless.push(e.to);
    }
    // 관련 Class + 상위 Class(상속 사슬)까지 모은다.
    const classSet = new Set();
    for (const cid of instByClass.keys()) {
      for (let c = cid; c && !classSet.has(c); c = this.classParent(c)) classSet.add(c);
    }
    // 부모-자식 맵 + 루트(상위가 집합 밖인 Class).
    const childrenOf = new Map();
    const classRoots = [];
    for (const cid of classSet) {
      const p = this.classParent(cid);
      if (p && classSet.has(p)) (childrenOf.get(p) || childrenOf.set(p, []).get(p)).push(cid);
      else classRoots.push(cid);
    }
    classRoots.sort(this.byLabel);

    const count = narrower.length + classRoots.length + classless.length;
    if (!count) return this.leaf(id);

    return this.expandable(id, count, (ul) => {
      for (const e of narrower) ul.appendChild(this.conceptItem(e.to));
      for (const cid of classRoots) ul.appendChild(this.classNode(cid, instByClass, childrenOf));
      for (const iid of classless.sort(this.byLabel)) ul.appendChild(this.leaf(iid));
    });
  }

  // Class > 인스턴스(leaf) + 하위 Class(상속) 재귀.
  classNode(classId, instByClass, childrenOf) {
    const insts = (instByClass.get(classId) || []).slice().sort(this.byLabel);
    const subs = (childrenOf.get(classId) || []).slice().sort(this.byLabel);
    return this.expandable(classId, insts.length + subs.length, (ul) => {
      for (const iid of insts) ul.appendChild(this.leaf(iid));
      for (const scid of subs) ul.appendChild(this.classNode(scid, instByClass, childrenOf));
    });
  }
}

customElements.define('graph-view', GraphView);
