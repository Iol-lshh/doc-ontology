'use strict';

// FindDocumentFacade (ADR 0013). 노드 본문 조회.
// id로 graphIndex에서 type을 알아내 .system/database/<type>/<id>.md 정규화 노드를 로드한다(ADR 0008).
// 단일 책임: 단건 본문 한 가지. 구조도·그래프는 다른 Facade가 본다.

const fs = require('node:fs');
const path = require('node:path');
const { load } = require('../config.js');
const indexService = require('../service/index-service.js');

const TYPE_DIR = { Concept: 'concept', Class: 'class', Instance: 'instance' };

function document(id) {
  const cfg = load();
  const { graphIndex } = indexService.read(cfg.systemDbDir);
  if (!graphIndex) return { ok: false, error: 'no index — build-ontology 먼저' };

  const meta = graphIndex.nodes[id];
  if (!meta) return { ok: false, error: `unknown id: ${id}` };

  const file = path.join(cfg.systemDbDir, TYPE_DIR[meta.type], `${id}.md`);
  if (!fs.existsSync(file)) return { ok: false, error: `node file not found: ${file}` };

  return { ok: true, id, type: meta.type, label: meta.label, content: fs.readFileSync(file, 'utf8') };
}

module.exports = { document };
