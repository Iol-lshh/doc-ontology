# ADR 0007: 인덱스 3종 분리

- Status: Accepted
- Date: 2026-06-19

## Context

조회 관점이 셋이다. id로 파일 찾기, 관계 타기, 사람이 아는 label로 노드 찾기. 한 구조에 다 넣으면 용도가 흐려진다.

## Decision

`.system/`에 인덱스 3종을 둔다. 모두 빌드 파생물이다.

- **`fileIndex.json`** — `id → 원본 파일 경로`. id로 실제 파일을 해소.
- **`graphIndex.json`** — `{ nodes: {id: {type, label}}, edges: [{from, to, rel}] }`. 노드는 id로만 참조, edge의 `rel`은 관계 종류(broader/narrower/related/about/class/seed).
- **`labelIndex.json`** — `label → id`. 사람이 아는 이름으로 노드 진입.

## Consequences

- 각 인덱스가 한 가지 조회만 책임진다.
- find/gui는 세 인덱스를 조합해 동작한다([[0008]]).
- 세 파일 모두 빌드가 동시에 재생성한다.
