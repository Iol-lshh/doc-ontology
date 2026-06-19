'use strict';

// snapshot-service (ADR 0010·0014). 빌드 통과 시점의 .system/database를 적재·복구한다.
// - 세대 스냅샷: git 객체 모델로 저장(blob/tree/commit, ADR 0014). 내용 해시라 변화 없으면 새 세대 안 생김.
// - 직전 여벌(backup/): 디렉터리 1세대 복사. 빌드 롤백 대상(ADR 0010). git 객체와 무관.
// 콘텐츠(정규화 노드 + 인덱스)만 다루고 history·backup은 제외(중첩 방지).
// 단일 책임: 스냅샷 적재·목록·복구. object-service에 git 포맷을 위임한다.

const fs = require('node:fs');
const path = require('node:path');
const os = require('./object-service.js');
const { timestampOf } = require('./id-service.js');

const HISTORY_DIR = 'history';
const BACKUP_DIR = 'backup';
const META = new Set([HISTORY_DIR, BACKUP_DIR]);

function historyPath(systemDbDir) {
  return path.join(systemDbDir, HISTORY_DIR);
}

// ── 콘텐츠 → git tree (재귀). 디렉터리는 tree, 파일은 blob. history·backup 제외. ──
function captureTree(systemDbDir, historyDir, dir) {
  const entries = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (dir === systemDbDir && META.has(e.name)) continue; // 최상위의 history·backup 제외
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      entries.push({ mode: os.DIR_MODE, name: e.name, sha: captureTree(systemDbDir, historyDir, full) });
    } else if (e.isFile()) {
      entries.push({ mode: os.FILE_MODE, name: e.name, sha: os.writeBlob(historyDir, fs.readFileSync(full)) });
    }
  }
  return os.writeTree(historyDir, entries);
}

// 그 시점의 콘텐츠를 새 세대(commit)로 적재. 직전 HEAD의 tree와 같으면 스킵.
// 반환: { generation(commit sha), unchanged } — unchanged면 새 세대 안 만듦.
function capture(systemDbDir, tsSec, tz) {
  const historyDir = historyPath(systemDbDir);
  const rootTree = captureTree(systemDbDir, historyDir, systemDbDir);

  const head = os.readHead(historyDir);
  if (head) {
    const headCommit = os.parseCommit(os.readObject(historyDir, head).payload);
    if (headCommit.tree === rootTree) return { generation: head, unchanged: true };
  }

  const commit = os.writeCommit(historyDir, {
    tree: rootTree,
    parent: head,
    message: 'build',
    tsSec,
    tz,
  });
  os.writeHead(historyDir, commit);
  return { generation: commit, unchanged: false };
}

// 세대 목록(최신→과거): HEAD부터 parent 체인 순회. 각 세대의 노드 수·시각 메타.
function list(systemDbDir) {
  const historyDir = historyPath(systemDbDir);
  let sha = os.readHead(historyDir);
  const out = [];
  while (sha) {
    const commit = os.parseCommit(os.readObject(historyDir, sha).payload);
    out.push({ generation: sha, nodeCount: countNodes(historyDir, commit.tree), ts: commit.tsSec * 1000 });
    sha = commit.parent;
  }
  return out.reverse(); // 과거 → 최신 (UI가 #1부터)
}

// tree에서 index/fileIndex.json blob을 찾아 노드 수를 센다.
function countNodes(historyDir, treeSha) {
  const indexTree = os.parseTree(os.readObject(historyDir, treeSha).payload).find((e) => e.name === 'index');
  if (!indexTree) return null;
  const fileIndex = os.parseTree(os.readObject(historyDir, indexTree.sha).payload).find((e) => e.name === 'fileIndex.json');
  if (!fileIndex) return null;
  const text = os.readObject(historyDir, fileIndex.sha).payload.toString('utf8').trim();
  return text ? Object.keys(JSON.parse(text)).length : 0;
}

// ── 복구: commit → tree → blob 펼쳐 .system 콘텐츠 교체(history·backup 보존) ──
function restoreTree(historyDir, treeSha, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const e of os.parseTree(os.readObject(historyDir, treeSha).payload)) {
    const target = path.join(destDir, e.name);
    if (e.mode === os.DIR_MODE) restoreTree(historyDir, e.sha, target);
    else fs.writeFileSync(target, os.readObject(historyDir, e.sha).payload);
  }
}

function clearContent(systemDbDir) {
  for (const e of fs.readdirSync(systemDbDir, { withFileTypes: true })) {
    if (META.has(e.name)) continue;
    fs.rmSync(path.join(systemDbDir, e.name), { recursive: true, force: true });
  }
}

function restoreGeneration(systemDbDir, generation) {
  const historyDir = historyPath(systemDbDir);
  const obj = os.readObject(historyDir, generation);
  if (!obj || obj.type !== 'commit') return false;
  clearContent(systemDbDir);
  restoreTree(historyDir, os.parseCommit(obj.payload).tree, systemDbDir);
  return true;
}

// ── 직전 여벌(backup) — 디렉터리 복사(ADR 0010). git 객체와 무관. ──
function copyContent(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (META.has(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyContent(s, d);
    else fs.copyFileSync(s, d);
  }
}

function captureBackup(systemDbDir) {
  const dest = path.join(systemDbDir, BACKUP_DIR);
  fs.rmSync(dest, { recursive: true, force: true });
  copyContent(systemDbDir, dest);
}

function hasBackup(systemDbDir) {
  return fs.existsSync(path.join(systemDbDir, BACKUP_DIR));
}

function restoreBackup(systemDbDir) {
  const src = path.join(systemDbDir, BACKUP_DIR);
  if (!fs.existsSync(src)) return false;
  clearContent(systemDbDir);
  copyContent(src, systemDbDir);
  return true;
}

module.exports = {
  capture,
  list,
  restoreGeneration,
  captureBackup,
  hasBackup,
  restoreBackup,
  HISTORY_DIR,
  BACKUP_DIR,
};
