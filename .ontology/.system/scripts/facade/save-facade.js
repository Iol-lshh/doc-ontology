'use strict';

// SaveFacade (ADR 0008·0010·0013). 현재 작업본(.system/database)을 영구 보존한다.
// build와 분리된 의식적 저장 — git의 commit에 해당.
//  1) 직전 저장본을 backup으로 밀어낸다(빌드 롤백 대상, ADR 0010).
//  2) 작업본을 새 세대로 적재한다(history, ADR 0010·0014). 그래프 동일하면 새 세대 안 만듦.
// snapshot-service를 조율할 뿐 저장 로직 자체는 갖지 않는다.

const { load } = require('../config.js');
const snapshotService = require('../service/snapshot-service.js');

function save() {
  const cfg = load();
  const systemDb = cfg.systemDbDir;

  // 직전 저장본(현재 작업본 = 마지막 build 결과)을 backup으로. 다음 save 전까지 빌드 롤백 대상.
  snapshotService.captureBackup(systemDb);

  // 작업본을 새 세대로 적재. history off면 건너뛴다(빌드 롤백은 backup으로 여전히 가능).
  let generation = null;
  let unchanged = false;
  if (cfg.history.enabled) {
    const now = new Date();
    const tsSec = Math.floor(now.getTime() / 1000);
    const off = -now.getTimezoneOffset();
    const tz = `${off >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}${String(Math.abs(off) % 60).padStart(2, '0')}`;
    const result = snapshotService.capture(systemDb, tsSec, tz);
    generation = result.generation;
    unchanged = result.unchanged;
  }

  return { ok: true, generation, unchanged };
}

module.exports = { save };
