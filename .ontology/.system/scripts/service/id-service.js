'use strict';

// id-service (ADR 0002). 노드에 안정 식별자(UUIDv7)를 발급한다.
// node randomUUID는 이 빌드에서 version:7 옵션을 무시하고 v4를 내므로 직접 만든다.
// 단일 책임: id 발급. 호출은 BuildFacade가 scan 결과를 받아 넘긴다(ADR 0013).

const crypto = require('node:crypto');

function uuidv7() {
  const bytes = crypto.randomBytes(16);

  // 상위 48bit = unix ms 타임스탬프
  const ms = Date.now();
  bytes[0] = (ms / 0x10000000000) & 0xff;
  bytes[1] = (ms / 0x100000000) & 0xff;
  bytes[2] = (ms / 0x1000000) & 0xff;
  bytes[3] = (ms / 0x10000) & 0xff;
  bytes[4] = (ms / 0x100) & 0xff;
  bytes[5] = ms & 0xff;

  // 버전 7 (상위 니블), 변형 비트(10xx)
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// 경로 기반 결정적 id. Class(폴더)는 frontmatter가 없어 id를 저장할 곳이 없으므로
// relPath를 해싱해 매 빌드 같은 id를 만든다(ADR 0002 안정성을 저장 없이 충족). UUID 형식 유지.
function idForPath(relPath) {
  const h = crypto.createHash('sha256').update('class:' + relPath).digest('hex');
  // 버전 니블 7, 변형 비트 10xx — 형식은 UUIDv7과 호환(값은 결정적).
  const b = h.slice(0, 32).split('');
  b[12] = '7';
  b[16] = ((parseInt(b[16], 16) & 0x3) | 0x8).toString(16);
  const x = b.join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

// 각 노드에 id를 부여해 돌려준다. 입력 노드는 변형하지 않는다.
// - Class(폴더): relPath 기반 결정적 id — 저장 없이 안정.
// - Concept/Instance: existingId 있으면 재사용, 없으면 UUIDv7 발급 + freshId 표시
//   (BuildFacade가 새 id만 골라 원본 frontmatter에 되쓰도록).
function assignIds(nodes) {
  return nodes.map((node) => {
    if (node.type === 'Class') return { ...node, id: idForPath(node.relPath), freshId: false };
    return node.existingId
      ? { ...node, id: node.existingId, freshId: false }
      : { ...node, id: uuidv7(), freshId: true };
  });
}

// UUIDv7에 박힌 생성 시각(ms)을 복원한다. 상위 48bit = 첫 12 hex(하이픈 제외).
function timestampOf(id) {
  return parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}

module.exports = { assignIds, uuidv7, idForPath, timestampOf };
