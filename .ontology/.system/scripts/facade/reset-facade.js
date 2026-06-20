'use strict';

// ResetFacade (리셋, ADR 0010·0013). 현재 HEAD 이후(자손) 세대를 버린다 — TIP을 HEAD로 당긴다.
// 체크로 과거에 가 본 뒤 그 시점부터 히스토리를 다시 쓰고 싶을 때 쓴다(이후 줄기 폐기).
// 유저 DB·시스템 DB·backup은 건드리지 않는다 — 히스토리 라인만 자른다.
// snapshot-service.truncate에 위임할 뿐 자르기 정책 자체는 갖지 않는다.

const { load } = require('../config.js');
const snapshotService = require('../service/snapshot-service.js');

function reset() {
  const cfg = load();
  if (!cfg.history.enabled) {
    return { ok: false, error: '히스토리 꺼짐(history.enabled=false) — 자를 히스토리가 없습니다.' };
  }
  return snapshotService.truncate(cfg.systemDbDir);
}

module.exports = { reset };
