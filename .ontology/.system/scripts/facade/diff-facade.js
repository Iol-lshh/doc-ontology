'use strict';

// DiffFacade (ADR 0012·0013). 두 스냅샷을 비교한다 — 그래프 diff(먼저) + 파일 diff(드릴다운).
// 비교 짝: 세대↔세대, 세대↔현재('current'). 읽기 전용 — 엔진 상태를 바꾸지 않는다.
// Service(snapshot·object)를 조율할 뿐 비교 로직 자체는 object-service.diffTrees에 위임한다.

const { load } = require('../config.js');
const snapshotService = require('../service/snapshot-service.js');
const diffService = require('../service/diff-service.js');

// 그래프 diff — 두 graphIndex의 노드·엣지를 비교(노드는 id 기준, 엣지는 from|rel|to 기준).
function graphDiff(a, b) {
  const aNodes = a?.nodes ?? {};
  const bNodes = b?.nodes ?? {};
  const nodes = { added: [], removed: [], changed: [] };
  for (const id of Object.keys(bNodes)) {
    if (!(id in aNodes)) nodes.added.push({ id, ...bNodes[id] });
    else if (JSON.stringify(aNodes[id]) !== JSON.stringify(bNodes[id]))
      nodes.changed.push({ id, from: aNodes[id], to: bNodes[id] });
  }
  for (const id of Object.keys(aNodes)) if (!(id in bNodes)) nodes.removed.push({ id, ...aNodes[id] });

  const key = (e) => `${e.from}|${e.rel}|${e.to}`;
  const aEdges = new Set((a?.edges ?? []).map(key));
  const bEdges = new Set((b?.edges ?? []).map(key));
  const edges = { added: [], removed: [] };
  for (const e of b?.edges ?? []) if (!aEdges.has(key(e))) edges.added.push(e);
  for (const e of a?.edges ?? []) if (!bEdges.has(key(e))) edges.removed.push(e);

  return { nodes, edges };
}

// from·to = 세대 commit sha, 'current', 또는 'backup'(ADR 0012).
function diff(from, to) {
  const sys = load().systemDbDir;

  const treeA = snapshotService.treeOf(sys, from);
  const treeB = snapshotService.treeOf(sys, to);
  if (treeA === null) return { ok: false, error: `비교 대상 없음: ${from}` };
  if (treeB === null) return { ok: false, error: `비교 대상 없음: ${to}` };

  // 그래프 diff (먼저 보임) + 파일 diff (드릴다운), ADR 0012
  const graph = graphDiff(snapshotService.graphOf(sys, treeA), snapshotService.graphOf(sys, treeB));
  const fileChanges = snapshotService.fileDiff(sys, treeA, treeB);

  // 변경 파일마다 양쪽 본문 줄 diff를 붙인다(좌=A, 우=B). 추가/삭제는 한쪽만.
  const lineDiffOf = (path, hasA, hasB) =>
    diffService.lineDiff(
      hasA ? snapshotService.blobAt(sys, treeA, path) : '',
      hasB ? snapshotService.blobAt(sys, treeB, path) : ''
    );
  const files = {
    added: fileChanges.added.map((path) => ({ path, lines: lineDiffOf(path, false, true) })),
    removed: fileChanges.removed.map((path) => ({ path, lines: lineDiffOf(path, true, false) })),
    modified: fileChanges.modified.map((path) => ({ path, lines: lineDiffOf(path, true, true) })),
  };

  return { ok: true, from, to, graph, files };
}

module.exports = { diff };
