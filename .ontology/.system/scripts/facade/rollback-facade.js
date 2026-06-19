'use strict';

// RollbackFacade (ADR 0010·0013). 롤백 유스케이스를 조율한다 — 두 종류.
// - 빌드 롤백: 직전 통과 여벌(backup)로 .system 복구. history off여도 가능.
// - 히스토리 롤백: 선택한 과거 세대 스냅샷으로 .system 복구. history off면 불가.
// 둘 다 .system만 바꾸고 database/ 원본은 보존한다.
// Service(snapshot)를 조율할 뿐 복구 로직 자체는 갖지 않는다.

const { load } = require('../config.js');
const snapshotService = require('../service/snapshot-service.js');

// 빌드 롤백 — 직전 여벌(backup)로 복구.
function buildRollback() {
  const cfg = load();
  if (!snapshotService.hasBackup(cfg.systemDbDir)) {
    return { ok: false, error: '여벌(backup) 없음 — 아직 빌드를 한 번도 덮어쓰지 않았습니다.' };
  }
  snapshotService.restoreBackup(cfg.systemDbDir);
  return { ok: true, kind: 'build' };
}

// 히스토리 롤백 — 선택한 세대 스냅샷으로 복구.
function historyRollback(generation) {
  const cfg = load();
  if (!cfg.history.enabled) {
    return { ok: false, error: '히스토리 꺼짐(history.enabled=false) — 히스토리 롤백 불가. 빌드 롤백은 가능.' };
  }
  if (!generation) {
    return { ok: false, error: 'generation을 지정하세요.' };
  }
  const restored = snapshotService.restoreGeneration(cfg.systemDbDir, generation);
  if (!restored) {
    return { ok: false, error: `세대 없음: ${generation}` };
  }
  return { ok: true, kind: 'history', generation };
}

module.exports = { buildRollback, historyRollback };
