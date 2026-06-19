# GUI/CLI 구현 계획

설계 결정(ADR 0011·0013)을 코드로 옮기기 위한 파일 목록·순서. 코드 착수 전 합의용.

## 확정된 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 그래프 구축 명령 | `build-ontology` | — |
| 레이어 | Controller → Facade → Service, 의존은 안쪽으로 | ADR 0013 |
| 진입점 | `cli.sh`(셸 래퍼) 하나. `cli.sh gui`로 GUI 기동 | — |
| CLI 진입 | Facade 직접 호출, 서버·하트비트 없음(단명) | ADR 0011 |
| GUI 진입 | `cli.sh gui` → 서버 + 브라우저 동시. 서버 있으면 브라우저만 | ADR 0011 |
| 브라우저 오픈 | node 서버가 listen 후 자기가 `open` 실행(race 없음) | — |
| 서버 재사용 판정 | 고정 포트 + health 확인. 응답하면 재사용, 거부면 기동 | — |
| GUI 포트 | `config.yml`의 `gui.port`(기본 7777) | ADR 0009 |
| 서버 종료 | 하트비트 끊기면 self-exit(GUI 전용) | ADR 0011 |
| `gui.html` 위치 | `.system/template/`(빌드가 값 채우는 템플릿) | ADR 0003 |
| Facade | 유스케이스/읽기소스당 1개, 총 7개 | ADR 0013 |

## 파일 배치

```
.ontology/
  config.yml                사람 영역 — gui.port 등 (ADR 0009)
  cli.sh                    얇은 진입 셸: node 위임
  database/                 사람 입력 (ADR 0003)

  .system/                  빌드/도구 영역, 사람 금지 (ADR 0003)
    template/
      gui.html              빌드가 값 채우는 템플릿 (신규 위치)
    scripts/
      cli-command-controller.js    argv 파싱 + 콘솔 출력 → Facade 호출
      gui-command-controller.js    HTTP 서버 + 정적제공 + POST + 하트비트/자동종료 + 브라우저 오픈
      facade/
        build.js                   BuildFacade
        rollback.js                RollbackFacade
        diff.js                    DiffFacade
        find-file-path.js          FindFilePathFacade
        find-graph.js              FindGraphFacade
        find-history.js            FindHistoryFacade
        find-document.js           FindDocumentFacade
      service/
        scan.js                    스캔·판정 (ADR 0005)
        verify.js                  검증 (ADR 0008)
        index.js                   인덱스 3종 읽기/쓰기 (ADR 0007)
        snapshot.js                스냅샷 적재/조회 (ADR 0010)
    database/                정규화 여벌 + 인덱스 + history (빌드 산출물)
```

## 구현 순서

빌드/조회 로직 전부를 한 번에 만들지 않고, ADR 0011의 부팅 뼈대부터 눈으로 확인한 뒤 명령을 붙인다.

1. **서버 골격** — `gui-command-controller.js`: 고정 포트 listen → 떠 있으면 재사용(health) / 없으면 기동 → `.system/template/gui.html` 정적 제공 → 브라우저 `open` → 하트비트 수신·타임아웃 self-exit. `cli.sh gui`가 이걸 호출.
   - 검증 지점: `cli.sh gui` 두 번 — 첫 번째 기동+오픈, 두 번째 브라우저만. 탭 닫으면 서버 종료.
2. **gui.html 최소 골격** — 탭 UI(구조도/그래프/히스토리/본문) + 하트비트 ping. 명령 버튼은 stub.
3. **Service** — scan/verify/index/snapshot 단일 책임 단위.
4. **Facade** — build → find류 → rollback → diff 순. 각 Facade가 Service 조율.
5. **Controller 연결** — cli/gui Controller가 명령별 Facade 호출. stub 제거.
6. **gui.html 템플릿화** — 빌드가 채울 값과 런타임 fetch로 받을 값 구분 확정.

## 미결 (구현 중 정함)

- gui.html에서 **빌드 주입 값 vs 런타임 fetch 값**의 경계 (6단계에서 확정)
- 하트비트 주기·타임아웃 구체값
- 브라우저 오픈 크로스플랫폼 여부 (현재 darwin `open` 기준, `xdg-open`/`start` 확장은 후순위)
