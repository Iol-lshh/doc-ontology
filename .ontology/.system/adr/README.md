# ADR 인덱스 — 산출물 온톨로지

`.ontology` 설계 결정 기록. 결정당 파일 하나(MADR).

| ADR | 결정 | 핵심 |
|---|---|---|
| [0001](0001-introduce-output-ontology.md) | 산출물 온톨로지 도입 | 본체(결론만)와 부속(근거·예제·이력)을 분리, 그래프로 연결 |
| [0002](0002-uuidv7-node-identity.md) | 노드 식별자 = UUIDv7 | basename 아닌 안정 id, 이동·개명에 불변 |
| [0003](0003-input-system-separation.md) | 입력/시스템 분리 | `database/`(사람) ↔ `.system/`(빌드, 사람 금지) |
| [0004](0004-skos-metamodel.md) | SKOS 메타모델 | type=Concept/Class/Instance + broader/narrower/related/about/class |
| [0005](0005-path-determines-type.md) | 경로가 type 결정 | 디렉터리 깊이로 Concept/Class/Instance 자동 판정 |
| [0006](0006-label-source-id-index.md) | 원본 label / 인덱스 id | 사람은 label, 빌드가 id로 변환 + 역방향 edge 자동 |
| [0007](0007-three-indexes.md) | 인덱스 3종 | fileIndex(id→경로) / graphIndex(관계) / labelIndex(label→id) |
| [0008](0008-build-on-verify-only.md) | 빌드/저장 분리, 검증 통과 시만 | build=작업본 갱신(verify 통과 시), save=세대 적재+backup. git working tree↔commit |
| [0009](0009-config-yml.md) | 설정을 config.yml로 | `.ontology/config.yml`(사람 영역)에 정책 — 입력 경로, 히스토리 on/off |
| [0010](0010-snapshot-history.md) | 스냅샷 이력 통합 | 빌드 통과 스냅샷으로 복원·버전 이력 통합. 무제한 보존, 빌드/히스토리 롤백 분리 |
| [0011](0011-symmetric-frontends.md) | GUI/CLI 대칭 프론트엔드 | 진입 비대칭·엔진 대칭. Cli/Gui Controller가 동일 Facade 호출, 하트비트 서버 |
| [0012](0012-snapshot-diff.md) | 스냅샷 비교 | 그래프 diff(노드·엣지) + 파일 diff. 세대↔세대, 세대↔현재 |
| [0013](0013-layered-srp.md) | 레이어 분리·SRP | Controller→Facade→Service, 의존은 안쪽으로. 유스케이스/읽기소스당 Facade |
| [0014](0014-git-object-store.md) | git 객체 스냅샷 저장 | 0010 저장 대체. blob/tree/commit(git 포맷), 내용 해시로 중복 세대 방지 |

## 데이터 흐름

```
[사람] config.yml                                  (정책: 입력 경로·히스토리 on/off, 0009)
       database/<concept>/<class>/<instance>.md     (본문 + label 관계만)
          │
       build-ontology  ── 경로로 type 판정(0005) · frontmatter 자동 채움(0006)
          │              · label→id 해소 · 역방향 edge 생성 · 검증(0008)
          ▼ (통과 시에만)
[.system] database/{concept,class,instance}/<id>.md   (정규화 여벌)
          database/history/<세대>/                     (스냅샷 이력, 0010)
          fileIndex.json · graphIndex.json · labelIndex.json   (0007)
          │
       Cli/Gui Controller → Facade → Service   (대칭 조회·명령·비교, 0011·0012·0013)
```
