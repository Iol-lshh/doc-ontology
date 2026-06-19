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

// 각 노드에 id를 발급해 돌려준다. 입력 노드는 변형하지 않는다.
function assignIds(nodes) {
  return nodes.map((node) => ({ ...node, id: uuidv7() }));
}

module.exports = { assignIds, uuidv7 };
