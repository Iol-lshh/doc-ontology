# ADR 0011: GUI/CLI는 동일 엔진을 호출하는 대칭 프론트엔드

- Status: Accepted
- Date: 2026-06-19

## Context

조회 표면이 둘이다(터미널 CLI, 브라우저 GUI). 둘 다 보기(조회)뿐 아니라 빌드·롤백(명령)도 해야 한다. 각자 로직을 가지면 동작이 갈리고 build-ontology/rollback 엔진과 책임이 겹친다.

## Decision

GUI와 CLI는 **동일 Facade·Service를 호출하고 동일 인덱스([[0007]])를 읽는 대칭 프론트엔드**다. 스캔·판정·검증·복원 로직은 Facade·Service에만 있고([[0013]]), 두 Controller는 호출·표시만 한다. **진입 경로는 비대칭이지만 엔진은 대칭이다** — 두 뷰가 공유하는 것은 엔진이지 진입 경로가 아니다.

**조회 (read)** — 인덱스·스냅샷을 읽음
- 파일 구조도 / 그래프 / 히스토리 / 본문 / 비교 보기([[0012]])

**명령 (action)** — 엔진을 호출해 상태를 바꿈
- 빌드 요청 → build-ontology([[0008]])
- 롤백 요청 → rollback([[0010]], 두 종류)

### 진입 구조

진입점은 채널별 **Controller**다. Controller는 진입이자 어댑터이며, 명령 로직은 갖지 않고 Facade로 위임한다(레이어·SRP는 [[0013]]).

| Controller | 책임 |
|---|---|
| `CliCommandController` | CLI 진입. argv 파싱 + 콘솔 출력. Facade 직접 호출(단명 프로세스) |
| `GuiCommandController` | GUI 진입. HTTP 서버(정적 제공 + POST) + 하트비트/자동종료(장수명 프로세스) |

두 Controller는 채널만 다르고 **같은 Facade**를 부른다. build-ontology·rollback·find·diff가 CLI용/GUI용으로 갈라질 자리를 두지 않는다.

| | CLI | GUI |
|---|---|---|
| 진입 | `CliCommandController`(단명 프로세스) | `GuiCommandController` 서버 경유(장수명 프로세스) |
| 조회 | `find` + `--path/--graph/--history` | 탭(구조도/그래프/히스토리/본문) |
| 명령 | `build-ontology` / `rollback` | 버튼 → 서버 엔드포인트(POST) |

- CLI는 같은 node 런타임에서 Facade를 직접 호출한다([[0009]] config 사용). 명령 1회 실행 후 즉시 종료하는 **단명** 프로세스라 서버도 하트비트도 필요 없다. CORS 제약은 CLI에 없다.
- GUI는 `file://` fetch가 CORS로 막히므로 `GuiCommandController`가 작은 node 서버를 띄워 진입한다. 서버는 정적 제공 + 명령 엔드포인트(POST build-ontology/rollback)를 가지며, 탭이 열려있는 동안 사는 **장수명** 프로세스다.
- 서버는 GUI와만 **하트비트**를 교환해 탭 닫힘·폴링 끊김을 감지하면 자신을 종료한다(자동종료). 하트비트를 보낼 주체는 살아있는 GUI 탭뿐이며, 단명 CLI는 하트비트 모델에 들어오지 않는다.

## Consequences

- 명령 로직은 Facade·Service에만 있고 두 뷰의 동작이 일치한다([[0013]]).
- GUI 명령은 서버를 경유하므로 서버가 단순 정적 서버보다 커진다.
- 하트비트로 좀비 서버를 남기지 않는다.
- CLI는 서버 부팅 없이 단독 실행된다. 서버 라이프사이클이 단명 명령에 묶이지 않는다.
