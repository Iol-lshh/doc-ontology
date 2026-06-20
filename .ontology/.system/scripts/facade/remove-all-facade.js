'use strict';

// RemoveAllFacade (완전 초기화). 온톨로지를 빈 상태로 되돌린다.
//  - database/(사람 입력) 내용 전부 삭제 — 폴더 자체는 빈 채로 남긴다.
//  - .system/database(빌드 산출물: 작업본·인덱스·정규화 노드·history·backup) 통째로 삭제.
// 되돌릴 수 없다 — Controller가 확인(confirm)을 받은 뒤에만 호출한다.
// 코드·템플릿(.system/scripts·template)은 건드리지 않는다.

const fs = require('node:fs');
const path = require('node:path');
const { load } = require('../config.js');

function removeAll() {
  const cfg = load();

  // 사람 입력 비우기: database/ 안의 모든 노드·폴더 삭제(database/ 자체는 유지).
  if (fs.existsSync(cfg.databaseDir)) {
    for (const entry of fs.readdirSync(cfg.databaseDir)) {
      fs.rmSync(path.join(cfg.databaseDir, entry), { recursive: true, force: true });
    }
  }

  // 빌드 산출물 통째로 삭제: 작업본·인덱스·정규화 노드 + history·backup.
  fs.rmSync(cfg.systemDbDir, { recursive: true, force: true });

  return { ok: true };
}

module.exports = { removeAll };
