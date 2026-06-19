# ADR 0008: 빌드는 검증 통과 시에만 .system 갱신

- Status: Accepted
- Date: 2026-06-19

## Context

`database/`는 사람이 편집하므로 깨질 수 있다(미해소 label, 중복, 끊긴 관계). 깨진 상태가 인덱스나 여벌에 반영되면 정상 복원본을 잃는다.

## Decision

엔진 유스케이스의 중심은 **build-ontology(빌드)**와 **find(찾기)**다([[0010]] rollback, [[0012]] diff가 더해진다). 각 유스케이스는 Facade가 조율하고 명령 로직은 Controller 밖에만 있다([[0011]]·[[0013]]). 빌드는 검증을 통과했을 때만 `.system`을 갱신한다.

- `database/` 스캔 → 자동 채움 → 관계 해소·검증.
- 검증 실패 시 인덱스·여벌(`.system/database/`)을 **갱신하지 않는다**. 깨진 상태는 남기지 않는다.
- 통과 시에만 정규화 노드(`.system/database/{concept,class,instance}/<id>.md`)와 인덱스 3종을 기록하고, 그 시점 스냅샷을 이력에 적재한다([[0010]]).
- `.system/database/`는 마지막으로 통과한 온톨로지의 여벌(복원본)이 된다.

## Consequences

- `.system/database/`는 항상 깨지지 않은 상태를 보장한다.
- 검증 실패 시 사람은 `database/`만 고치면 된다.
- find/gui는 항상 정상 인덱스만 본다([[0007]]).
- 통과 스냅샷이 누적되어 과거 시점 복원이 가능하다([[0010]]).
