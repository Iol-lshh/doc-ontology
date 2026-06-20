'use strict';

// RestoreFacade (초기화, ADR 0008·0010·0013). 작업본과 유저 DB를 backup(마지막 저장 안전망)으로 되돌린다.
//  1) 시스템 DB(.system/database)를 backup으로 복원(snapshot)
//  2) 유저 DB(database/)를 그 정규화 구조에서 역생성(reconstruct)
//  3) backup은 마지막 저장(=TIP) 상태이므로 커서(HEAD)를 TIP에 정렬한다(내용↔커서 일치).
// 히스토리·backup 자체는 건드리지 않는다. snapshot·reconstruct Service를 조율할 뿐이다.

const { load } = require('../config.js');
const snapshotService = require('../service/snapshot-service.js');
const reconstructService = require('../service/reconstruct-service.js');

function restore() {
  const cfg = load();
  const restored = snapshotService.restoreBackup(cfg.systemDbDir);
  if (!restored) {
    return { ok: false, error: '백업 없음 — save를 먼저 하세요.' };
  }
  const rec = reconstructService.reconstruct(cfg.systemDbDir, cfg.databaseDir);
  if (!rec.ok) {
    return { ok: false, error: rec.error };
  }
  const tip = snapshotService.tip(cfg.systemDbDir);
  if (tip) snapshotService.setHead(cfg.systemDbDir, tip);
  return { ok: true };
}

module.exports = { restore };
