# ADR 0014: 스냅샷 저장을 git 객체 모델로

- Status: Accepted
- Date: 2026-06-19
- Supersedes: [[0010]]의 저장 메커니즘(세대별 디렉터리 통째 복사). 0010의 복원 정책(빌드 롤백/히스토리 롤백, backup, history.enabled)은 유지된다.

## Context

[[0010]]은 빌드 통과 시점을 `history/<세대>/`에 **디렉터리 통째로 복사**해 보존했다. 두 문제가 드러났다.

- **변화 없는 빌드가 새 세대를 만든다.** 입력이 같아도 매 빌드가 통째 복사본을 쌓아 세대가 무의미하게 늘었다.
- **노드 id가 재빌드마다 바뀌어** 세대 간 동일 노드를 추적할 수 없었다([[0002]] 안정성 위반). → 별도로 해소(원본에 id 되쓰기, [[0006]]).

git이 이 문제를 푸는 방식이 정확히 필요한 것이다 — **내용 주소화**: 내용이 같으면 같은 해시 → 같은 객체, 새로 만들지 않는다. tree가 안 바뀌면 "nothing to commit".

## Decision

스냅샷을 **git 객체 모델**로 저장한다. git 명령에 의존하지 않고 git **포맷 그대로** 직접 쓴다(`git cat-file`로 읽힌다).

### 객체 포맷 (git 동일)

각 객체 = `<type> <byteLen>\0<payload>` 를 **zlib deflate**, 식별자 = 그 **무압축 바이트의 SHA-1**(hex 40자).

- **blob** — `blob <len>\0<내용>`. payload는 파일 내용 그대로.
- **tree** — `tree <len>\0` + 엔트리들. 각 엔트리 = `<mode> <name>\0<20-byte raw sha>`. 엔트리는 name 정렬. mode는 파일 `100644`, 디렉터리 `40000`.
- **commit** — `commit <len>\0tree <sha>\n[parent <sha>\n]<author>\n<committer>\n\n<message>\n`.

### 저장 레이아웃

`history/`가 곧 git 저장소다([[0010]]의 history 자리).

```
.system/database/history/
  objects/<sha 앞2>/<나머지38>    blob·tree·commit (zlib 압축)
  HEAD                            최신 commit sha (세대 체인의 끝)
```

### 도메인 매핑

| 우리 | git 객체 |
|---|---|
| 노드 본문 `.md`, 인덱스 `*.json`(graphIndex 포함) | blob |
| 디렉터리(concept/class/instance/index)·루트 | tree |
| 세대 | commit (직전 세대를 parent로) |

graphIndex도 blob이므로 그래프 변화가 그 blob 해시 → 상위 tree 해시에 전파된다.

### 중복 방지

빌드 통과 후 루트 tree를 만들고, 그 sha가 **HEAD commit의 tree sha와 같으면 새 commit을 만들지 않는다**(nothing to commit). 다르면 새 commit(parent=직전 HEAD)을 쓰고 HEAD를 옮긴다. 같은 입력 재빌드는 세대를 늘리지 않는다.

세대 식별자는 commit sha(내용 기반)다 — [[0010]]의 UUIDv7 세대 id를 대체한다. 시각은 commit의 committer 타임스탬프에서 읽는다.

## Consequences

- 변화 없는 빌드는 세대를 늘리지 않는다.
- 안 바뀐 blob·tree는 해시가 같아 저장이 공유된다(중복 없음).
- 세대 비교([[0012]])는 commit→tree→blob 해시 비교로 얻는다 — 다른 해시만 따라가면 변경점이다.
- `git cat-file -p <sha>`로 우리 객체를 검증할 수 있다.
- SHA-1·zlib·바이트 포맷을 정확히 맞춰야 한다(하나라도 틀리면 해시 불일치).
