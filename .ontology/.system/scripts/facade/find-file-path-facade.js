'use strict';

// FindFilePathFacade (ADR 0013). 파일 구조도 조회.
// fileIndex 전체(id→relPath)를 디렉터리 트리로 조립한다(ADR 0005 계층 = 폴더 구조).
// 단일 책임: 구조도 한 가지. graphIndex·본문은 다른 Facade가 본다.

const { load } = require('../config.js');
const indexService = require('../service/index-service.js');

function tree() {
  const cfg = load();
  const { fileIndex, graphIndex } = indexService.read(cfg.systemDbDir);
  if (!fileIndex) return { ok: false, error: 'no index — build-ontology 먼저' };

  const root = { name: '', children: {}, node: null };
  for (const [id, relPath] of Object.entries(fileIndex)) {
    const parts = relPath.replace(/\.md$/, '').split('/');
    const leaf = parts[parts.length - 1];
    let cur = root;
    for (const part of parts) {
      cur.children[part] ||= { name: part, children: {}, node: null };
      cur = cur.children[part];
    }
    cur.node = { id, type: graphIndex?.nodes?.[id]?.type ?? null, label: graphIndex?.nodes?.[id]?.label ?? leaf };
  }

  // children 맵 → 정렬된 배열로
  const toArray = (n) => ({
    name: n.name,
    node: n.node,
    children: Object.values(n.children)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toArray),
  });

  return { ok: true, tree: toArray(root).children };
}

module.exports = { tree };
