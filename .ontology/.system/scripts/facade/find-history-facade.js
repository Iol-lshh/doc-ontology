'use strict';

// FindHistoryFacade (ADR 0013). 세대 히스토리 조회.
// snapshot-service로 적재된 세대 목록(시간순)을 반환한다(ADR 0010).
// 단일 책임: 세대 목록 한 가지. 빌드·구조도·그래프는 다른 Facade가 본다.

const { load } = require('../config.js');
const snapshotService = require('../service/snapshot-service.js');

function history() {
  const cfg = load();
  if (!cfg.history.enabled) {
    return { ok: true, enabled: false, generations: [] };
  }
  const generations = snapshotService.list(cfg.systemDbDir);
  return { ok: true, enabled: true, generations };
}

module.exports = { history };
