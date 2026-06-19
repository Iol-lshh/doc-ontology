'use strict';

// snapshot-service (ADR 0010). 빌드 통과 시점의 .system/database를 적재·복구한다.
// - 세대 스냅샷(history/<UUIDv7>): 무제한 누적, 시간순. 히스토리 롤백 대상.
// - 직전 여벌(backup/): 1세대만. 빌드 롤백 대상. history와 무관하게 보관.
// 콘텐츠(정규화 노드 + 인덱스)만 복사하고 history·backup은 제외(중첩 방지).
// 단일 책임: 스냅샷 적재·목록·복구. 적재 여부·시점 판단은 BuildFacade가 한다.

const fs = require('node:fs');
const path = require('node:path');
const { uuidv7, timestampOf } = require('./id-service.js');

const HISTORY_DIR = 'history';
const BACKUP_DIR = 'backup';
const META = new Set([HISTORY_DIR, BACKUP_DIR]); // 콘텐츠가 아닌 메타 디렉터리

// 콘텐츠(history·backup 제외)만 src→dest로 복사한다.
function copyContent(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (META.has(entry.name)) continue; // 스냅샷/여벌 안에 스냅샷/여벌을 넣지 않는다
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyContent(s, d);
    else fs.copyFileSync(s, d);
  }
}

// systemDbDir의 콘텐츠 디렉터리(history·backup 제외)를 비운다 — 복구 전 정리용.
function clearContent(systemDbDir) {
  for (const entry of fs.readdirSync(systemDbDir, { withFileTypes: true })) {
    if (META.has(entry.name)) continue;
    fs.rmSync(path.join(systemDbDir, entry.name), { recursive: true, force: true });
  }
}

// 그 시점의 콘텐츠를 새 세대로 적재. 세대 id를 돌려준다.
function capture(systemDbDir) {
  const generation = uuidv7();
  copyContent(systemDbDir, path.join(systemDbDir, HISTORY_DIR, generation));
  return generation;
}

// 빌드 직전 콘텐츠를 backup/(1세대)에 보관. 기존 backup은 덮어쓴다.
function captureBackup(systemDbDir) {
  const dest = path.join(systemDbDir, BACKUP_DIR);
  fs.rmSync(dest, { recursive: true, force: true });
  copyContent(systemDbDir, dest);
}

// backup이 있는지.
function hasBackup(systemDbDir) {
  return fs.existsSync(path.join(systemDbDir, BACKUP_DIR));
}

// 주어진 소스(backup 또는 history/<세대>)의 콘텐츠를 .system으로 복구한다.
// .system의 콘텐츠만 갈아끼우고 history·backup은 보존한다.
function restoreFrom(systemDbDir, srcDir) {
  if (!fs.existsSync(srcDir)) return false;
  clearContent(systemDbDir);
  copyContent(srcDir, systemDbDir);
  return true;
}

function restoreBackup(systemDbDir) {
  return restoreFrom(systemDbDir, path.join(systemDbDir, BACKUP_DIR));
}

function restoreGeneration(systemDbDir, generation) {
  return restoreFrom(systemDbDir, path.join(systemDbDir, HISTORY_DIR, generation));
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

module.exports = {
  capture,
  captureBackup,
  hasBackup,
  list,
  restoreBackup,
  restoreGeneration,
  HISTORY_DIR,
  BACKUP_DIR,
};
