# ADR 0004: SKOS 계열 메타모델 채택

- Status: Accepted
- Date: 2026-06-19

## Context

노드 간 관계가 단순 부모-자식 하나로는 부족하다. 개념의 계층(상위어/하위어), 연관, 그리고 개념-분류-사례의 구분이 필요하다.

## Decision

SKOS 계열 메타모델을 쓴다. 노드는 `type`으로 분류한다.

- **Concept** (기본) — 개념. `broader`(상위어)/`narrower`(하위어)/`related`(연관) 사용.
- **Class** — 분류. `about`으로 Concept 연결.
- **Instance** — 사례. `about`으로 Concept, `class`로 Class 연결.

식별·이력 메타: `id`/`seedId`(직속 상위)/`historyId`(최초 버전)/`version`/`label`/`status`/`registered`.

## Consequences

- 계층·연관·분류를 표준 어휘로 표현한다.
- type별 사용 가능 필드가 갈린다 → 빌드·검증이 type을 알아야 한다([[0005]]).
- 관계는 label로 쓰고 id로 인덱싱한다([[0006]]).
