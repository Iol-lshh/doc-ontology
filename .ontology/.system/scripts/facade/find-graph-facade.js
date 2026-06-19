'use strict';

// FindGraphFacade (ADR 0013). 관계 그래프 조회.
// graphIndex(nodes + edges, ADR 0007)를 반환한다. 노드는 id, edge는 정/역방향 모두 포함.
// 단일 책임: 그래프 한 가지. 구조도·본문은 다른 Facade가 본다.

const { load } = require('../config.js');
const indexService = require('../service/index-service.js');

function graph() {
  const cfg = load();
  const { graphIndex } = indexService.read(cfg.systemDbDir);
  if (!graphIndex) return { ok: false, error: 'no index — build-ontology 먼저' };
  return { ok: true, nodes: graphIndex.nodes, edges: graphIndex.edges };
}

module.exports = { graph };
