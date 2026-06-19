# ADR 0006: 원본은 label, 인덱스는 id

- Status: Accepted
- Date: 2026-06-19

## Context

관계를 id([[0002]])로 직접 쓰면 사람이 작성할 수 없다(id는 못 읽는다). label로만 쓰면 label 변경 시 관계가 깨진다.

## Decision

- **원본(`database/`)** — 사람은 관계를 **label**로 쓴다. `broader: ["Output Guide"]`.
- **인덱스(graphIndex)** — 빌드가 label→id로 해소해 **id**로 박는다.
- 빌드가 빈 frontmatter(id·historyId·version·status·registered)를 자동 채워 원본에 되쓴다.
- **역방향 edge를 빌드가 자동 생성**한다(원본엔 한 방향만). 역방향 규칙:

| 정방향 | 역방향 |
|---|---|
| `broader` | `narrower` |
| `narrower` | `broader` |
| `related` | `related` (대칭) |
| `about` | `isAboutOf` |
| `class` | `hasInstance` |

`about`·`class`는 위치/label로 정해지는 단방향 관계지만, 역(`isAboutOf`·`hasInstance`)을 함께 박아 Concept·Class에서 "나를 설명하는 노드"·"내 사례"를 양방향으로 탐색한다.

## Consequences

- 사람은 id 없이 직관적으로 작성한다.
- label이 바뀌어도 graphIndex(id 기반)는 불변이다.
- label→id 다리로 labelIndex가 필요하다([[0007]]).
- 빌드가 `database/` 원본을 쓰는 유일한 예외다([[0003]]).
