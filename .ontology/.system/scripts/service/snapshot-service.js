'use strict';

// snapshot-service (ADR 0010). 빌드 통과 시점의 .system/database를 세대별로 적재·조회한다.
// 세대 id = UUIDv7(id-service 재사용) — 시간순 정렬, 충돌 없음.
// 선형 모델(빌드 통과 한 줄), 세대 제한 없이 전부 보존. history 디렉터리는 적재 대상에서 제외(자기 복사 방지).
// 단일 책임: 스냅샷 적재·목록·로드. 적재 여부(history.enabled) 판단은 BuildFacade가 한다.

const fs = require('node:fs');
const path = require('node:path');
const { uuidv7, timestampOf } = require('./id-service.js');

const HISTORY_DIR = 'history';

// systemDbDir 아래에서 history를 뺀 나머지(정규화 노드 + 인덱스)를 dest로 복사한다.
function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === HISTORY_DIR) continue; // 스냅샷 안에 스냅샷을 넣지 않는다
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 그 시점의 .system/database를 새 세대로 적재. 세대 id를 돌려준다.
function capture(systemDbDir) {
  const generation = uuidv7();
  const dest = path.join(systemDbDir, HISTORY_DIR, generation);
  copyTree(systemDbDir, dest);
  return generation;
}

// 세대 id 목록(시간순 = UUIDv7 정렬). 각 세대의 노드 수 메타를 함께 준다.
function list(systemDbDir) {
  const historyDir = path.join(systemDbDir, HISTORY_DIR);
  if (!fs.existsSync(historyDir)) return [];
  return fs
    .readdirSync(historyDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((generation) => {
      const fileIndexPath = path.join(historyDir, generation, 'index', 'fileIndex.json');
      let nodeCount = null;
      if (fs.existsSync(fileIndexPath)) {
        const text = fs.readFileSync(fileIndexPath, 'utf8').trim();
        nodeCount = text ? Object.keys(JSON.parse(text)).length : 0;
      }
      // 세대 id(UUIDv7)에 박힌 생성 시각(ms). 표시 포맷은 보는 쪽(브라우저)이 한다.
      return { generation, nodeCount, ts: timestampOf(generation) };
    });
}

module.exports = { capture, list, HISTORY_DIR };
