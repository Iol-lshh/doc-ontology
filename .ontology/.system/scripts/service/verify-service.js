'use strict';

// verify-service (ADR 0008). 빌드 산출물을 기록하기 전에 깨진 곳을 찾는다.
// - 미해소 label: index-service가 모은 unresolved
// - label 중복: 같은 label을 가진 노드 둘 이상(label→id 해소가 모호해짐)
// - id 중복: 발급 사고
// 단일 책임: 검증 결과(에러 목록) 산출. 기록 여부 판단은 BuildFacade가 한다.

function verify(nodes, indexes) {
  const errors = [];

  // 미해소 label
  for (const u of indexes.unresolved) {
    const fromPath = indexes.fileIndex[u.from] || u.from;
    errors.push(`미해소 ${u.rel}: "${u.label}" (출처 ${fromPath})`);
  }

  // label 중복
  const byLabel = {};
  for (const n of nodes) (byLabel[n.label] ||= []).push(n.relPath);
  for (const [label, paths] of Object.entries(byLabel)) {
    if (paths.length > 1) errors.push(`label 중복 "${label}": ${paths.join(', ')}`);
  }

  // id 중복
  const byId = {};
  for (const n of nodes) (byId[n.id] ||= []).push(n.relPath);
  for (const [id, paths] of Object.entries(byId)) {
    if (paths.length > 1) errors.push(`id 중복 ${id}: ${paths.join(', ')}`);
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { verify };
