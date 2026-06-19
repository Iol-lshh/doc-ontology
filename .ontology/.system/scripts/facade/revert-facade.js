'use strict';

// RevertFacade (ADR 0010·0013). 작업본을 특정 세대 내용으로 되돌린다.
// git checkout처럼 작업본(.system/database)만 바꾼다 — backup·history·HEAD는 건드리지 않는다.
// 되돌린 작업본을 새 세대로 올리려면 save해야 한다(저장 전까지 히스토리 라인 불변, ADR 0008).
// backup은 안전망이라 revert로 바뀌지 않는다(save 때만 갱신).

const { load } = require('../config.js');
const snapshotService = require('../service/snapshot-service.js');

function revert(generation) {
  const cfg = load();
  if (!cfg.history.enabled) {
    return { ok: false, error: '히스토리 꺼짐(history.enabled=false) — 되돌릴 세대가 없습니다.' };
  }
  if (!generation) {
    return { ok: false, error: '되돌릴 세대(generation)를 지정하세요.' };
  }
  const restored = snapshotService.restoreGeneration(cfg.systemDbDir, generation);
  if (!restored) {
    return { ok: false, error: `세대 없음: ${generation}` };
  }
  return { ok: true, generation };
}

module.exports = { revert };
