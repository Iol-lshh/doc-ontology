# ADR 0008: 빌드는 검증 통과 시에만 .system 갱신

- Status: Accepted
- Date: 2026-06-19

## Context

`database/`는 사람이 편집하므로 깨질 수 있다(미해소 label, 중복, 끊긴 관계). 깨진 상태가 인덱스나 여벌에 반영되면 정상 복원본을 잃는다.

## Decision

**빌드와 저장을 나눈다**(git의 working tree ↔ commit). 빌드는 자주·가볍게, 저장은 의식적으로 한다.

- **build-ontology** — `database/` 스캔 → 자동 채움 → 관계 해소·검증 → 통과 시 `.system/database`(작업본)를 갱신. **history·backup은 건드리지 않는다.**
- **save** — 현재 작업본을 영구 보존: 직전 저장본을 backup으로 밀어내고([[0010]]), 작업본을 새 세대로 적재한다([[0010]]·[[0014]]). 그래프가 직전 저장과 같으면 새 세대를 만들지 않는다([[0014]]).
- **find**([[0007]]) / **rollback**([[0010]]) / **diff**([[0012]]) — 조회·복원·비교.

빌드는 검증을 통과했을 때만 작업본을 갱신한다.

- 검증 실패 시 작업본(`.system/database/`)을 **갱신하지 않는다**. 깨진 상태는 남기지 않는다.
- 통과 시 정규화 노드(`.system/database/{concept,class,instance}/<id>.md`)와 인덱스 3종을 기록한다(작업본).
- `.system/database/`(작업본)는 마지막으로 통과한 온톨로지다. 영구 보존은 save가 한다.

build와 save가 갈리므로 시점이 명확하다 — diff의 `current`(작업본, [[0012]])는 build 결과, `backup`은 마지막 save 직전 저장본이다. build만 반복해도 세대·backup은 불변이다.

## Consequences

- `.system/database/`는 항상 깨지지 않은 상태를 보장한다.
- 검증 실패 시 사람은 `database/`만 고치면 된다.
- find/gui는 항상 정상 인덱스만 본다([[0007]]).
- 통과 스냅샷이 누적되어 과거 시점 복원이 가능하다([[0010]]).
