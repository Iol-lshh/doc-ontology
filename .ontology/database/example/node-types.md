---
id: 019edfc9-9758-7f2c-9109-508cb6668c6f
about: ["산출물 온톨로지"]
---

# 노드 type 예시

경로가 type을 정한다(빌드가 판정).

- `database/ontology.md` — 루트 직속 `.md`라서 **Concept**
- `database/example/` — 디렉터리라서 **Class**
- `database/example/node-types.md` — Class 안의 `.md`라서 **Instance** (class=example 자동)

Instance는 부모 폴더에서 `class`가 자동으로 정해지고, `about`으로 Concept을 가리킨다.
