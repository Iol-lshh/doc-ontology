# ADR 0005: 디렉터리 계층이 type을 결정

- Status: Accepted
- Date: 2026-06-19

## Context

노드의 `type`(Concept/Class/Instance, [[0004]])을 사람이 매번 손으로 쓰면 실수가 생기고 작성 부담이 늘어난다.

## Decision

`database/` 아래 **`.md` 파일의 위치와 디렉터리로 type을 자동 판정**한다.

- `database/` 직속 `.md` = **Concept**
- 디렉터리 = **Class**. 디렉터리가 디렉터리를 품으면 Class 간 **상속**
- Class(디렉터리) 안의 `.md` = **Instance**

```
database/
  output-guide.md        Concept (루트 직속 .md)
  example/               Class
    basic.md             Instance
    nested/              Class (example 상속)
      x.md               Instance
```

빌드가 경로를 보고 type을 정하며, frontmatter의 `type`은 빌드가 덮어쓴다(경로가 진실).

## Consequences

- 사람은 파일을 올바른 위치에 두기만 하면 type이 정해진다.
- 디렉터리 구조와 온톨로지 계층이 일치한다. 디렉터리 중첩이 곧 Class 상속이다.
- 파일을 옮기면 type이 바뀐다 → 이동은 의미 변경임을 인지해야 한다.
