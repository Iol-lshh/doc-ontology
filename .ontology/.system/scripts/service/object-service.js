'use strict';

// object-service (ADR 0014). git 포맷 blob/tree/commit를 .system/database/history 아래에 직접 쓴다.
// git 명령에 의존하지 않지만 포맷이 동일해 `git cat-file`로 읽힌다.
// 객체 = '<type> <byteLen>\0<payload>' 를 zlib deflate, sha = 무압축 바이트의 SHA-1.
// 단일 책임: git 객체 저장(쓰기·읽기·해시). 세대 정책은 snapshot-service가 조율한다.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const OBJECTS = 'objects';
const HEAD = 'HEAD';
const FILE_MODE = '100644';
const DIR_MODE = '40000';

function objectsDir(historyDir) {
  return path.join(historyDir, OBJECTS);
}

// '<type> <len>\0<payload>' 의 SHA-1(hex). payload는 Buffer.
function hashOf(type, payload) {
  const header = Buffer.from(`${type} ${payload.length}\0`, 'binary');
  const store = Buffer.concat([header, payload]);
  return { sha: crypto.createHash('sha1').update(store).digest('hex'), store };
}

// 객체를 zlib 압축해 objects/<2>/<38>에 쓴다(이미 있으면 그대로). sha 반환.
function writeObject(historyDir, type, payload) {
  const { sha, store } = hashOf(type, payload);
  const file = path.join(objectsDir(historyDir), sha.slice(0, 2), sha.slice(2));
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, zlib.deflateSync(store));
  }
  return sha;
}

function writeBlob(historyDir, content) {
  return writeObject(historyDir, 'blob', Buffer.isBuffer(content) ? content : Buffer.from(content));
}

// entries: [{ mode, name, sha }]. name 정렬, '<mode> <name>\0<20byte raw sha>' 연결.
function writeTree(historyDir, entries) {
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const parts = sorted.map((e) =>
    Buffer.concat([Buffer.from(`${e.mode} ${e.name}\0`, 'binary'), Buffer.from(e.sha, 'hex')])
  );
  return writeObject(historyDir, 'tree', Buffer.concat(parts));
}

// commit. tsSec = unix 초, tz 예: '+0900'. parent 없으면 생략.
function writeCommit(historyDir, { tree, parent, message, tsSec, tz }) {
  const who = `ontology <ontology@local> ${tsSec} ${tz}`;
  let body = `tree ${tree}\n`;
  if (parent) body += `parent ${parent}\n`;
  body += `author ${who}\ncommitter ${who}\n\n${message}\n`;
  return writeObject(historyDir, 'commit', Buffer.from(body, 'utf8'));
}

// 객체 읽기 → { type, payload(Buffer) }. zlib 풀고 헤더 분리.
function readObject(historyDir, sha) {
  const file = path.join(objectsDir(historyDir), sha.slice(0, 2), sha.slice(2));
  if (!fs.existsSync(file)) return null;
  const store = zlib.inflateSync(fs.readFileSync(file));
  const nul = store.indexOf(0);
  const [type] = store.slice(0, nul).toString('binary').split(' ');
  return { type, payload: store.slice(nul + 1) };
}

// tree payload → [{ mode, name, sha }]
function parseTree(payload) {
  const entries = [];
  let i = 0;
  while (i < payload.length) {
    const sp = payload.indexOf(0x20, i);
    const mode = payload.slice(i, sp).toString('binary');
    const nul = payload.indexOf(0, sp);
    const name = payload.slice(sp + 1, nul).toString('utf8');
    const sha = payload.slice(nul + 1, nul + 21).toString('hex');
    entries.push({ mode, name, sha });
    i = nul + 21;
  }
  return entries;
}

// commit payload → { tree, parent, tsSec }
function parseCommit(payload) {
  const text = payload.toString('utf8');
  const tree = text.match(/^tree ([0-9a-f]{40})$/m)?.[1] ?? null;
  const parent = text.match(/^parent ([0-9a-f]{40})$/m)?.[1] ?? null;
  const tsSec = Number(text.match(/^committer .*? (\d+) [+-]\d{4}$/m)?.[1] ?? 0);
  return { tree, parent, tsSec };
}

function readHead(historyDir) {
  const file = path.join(historyDir, HEAD);
  if (!fs.existsSync(file)) return null;
  const sha = fs.readFileSync(file, 'utf8').trim();
  return sha || null;
}

function writeHead(historyDir, sha) {
  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(path.join(historyDir, HEAD), sha + '\n');
}

module.exports = {
  writeBlob,
  writeTree,
  writeCommit,
  readObject,
  parseTree,
  parseCommit,
  readHead,
  writeHead,
  FILE_MODE,
  DIR_MODE,
};
