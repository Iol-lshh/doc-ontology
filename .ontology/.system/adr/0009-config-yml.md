# ADR 0009: 설정을 config.yml로 분리

- Status: Accepted
- Date: 2026-06-19

## Context

스냅샷 이력([[0010]])을 도입하면 "몇 세대 보관", "입력 경로" 같은 정책 값이 생긴다. 코드에 박으면 사람이 조정할 수 없다.

## Decision

`.ontology/config.yml`에 정책을 둔다. 위치는 `.system` **밖**이다 — 사람이 조정하는 설정이므로 사람 영역([[0003]])에 둔다.

초기 항목:
- `system.database.path` — 빌드 산출물(`.system/database`) 위치. 기본 `./.system/database/`. config.yml 위치(.ontology) 기준 resolve하며 상대(`../` 포함)·절대경로 모두 허용한다. 산출물은 재생성 가능한 파생물([[0003]])이라 레포 밖으로 빼 `.gitignore`할 수 있다. 사람 입력 `database/`는 고정이라 config 대상이 아니다.
- `history.enabled` — 스냅샷 이력 on/off([[0010]]). off면 히스토리 롤백 불가, 빌드 롤백은 가능.
- `gui.port` — GUI 서버 포트([[0011]]).

빌드가 이 파일을 읽어 동작을 결정한다.

## Consequences

- 정책이 코드와 분리되어 사람이 조정한다.
- 빌드는 config를 읽는 의존이 생긴다(없으면 기본값).
- `.system`은 여전히 사람 금지([[0003]])를 유지한다.
