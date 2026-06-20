'use strict';

// CheckoutFacade (체크, ADR 0010·0013). 작업본과 유저 DB를 특정 세대 구조로 옮긴다.
// git checkout처럼 커서(HEAD)만 그 세대로 옮긴다 — TIP·backup·히스토리 라인은 불변.
//  1) 시스템 DB(.system/database)를 그 세대로 복원(snapshot)
//  2) 유저 DB(database/)를 그 정규화 구조에서 역생성(reconstruct) — 스냅샷은 시스템 DB만 담으므로
//  3) HEAD를 그 세대로 이동(TIP은 그대로 — 이후 세대로 다시 체크 가능, 버리려면 reset)
// snapshot·reconstruct Service를 조율할 뿐 복원·역생성 로직 자체는 갖지 않는다.

const { load } = require('../config.js');
const snapshotService = require('../service/snapshot-service.js');
const reconstructService = require('../service/reconstruct-service.js');

function checkout(generation) {
  const cfg = load();
  if (!cfg.history.enabled) {
    return { ok: false, error: '히스토리 꺼짐(history.enabled=false) — 체크할 세대가 없습니다.' };
  }
  if (!generation) {
    return { ok: false, error: '체크할 세대(generation)를 지정하세요.' };
  }
  const restored = snapshotService.restoreGeneration(cfg.systemDbDir, generation);
  if (!restored) {
    return { ok: false, error: `세대 없음: ${generation}` };
  }
  const rec = reconstructService.reconstruct(cfg.systemDbDir, cfg.databaseDir);
  if (!rec.ok) {
    return { ok: false, error: rec.error };
  }
  snapshotService.setHead(cfg.systemDbDir, generation);
  return { ok: true, generation };
}

module.exports = { checkout };
