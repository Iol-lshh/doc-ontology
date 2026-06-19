// 서버 엔드포인트 fetch 래퍼. 컴포넌트는 이걸 통해서만 서버와 통신한다.

export const api = {
  filePath: () => fetch('/find/file-path').then((r) => r.json()),
  graph: () => fetch('/find/graph').then((r) => r.json()),
  history: () => fetch('/find/history').then((r) => r.json()),
  document: (id) => fetch('/find/document?id=' + encodeURIComponent(id)).then((r) => r.json()),
  diff: (from, to) =>
    fetch(`/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then((r) => r.json()),
  command: (cmd) => fetch('/' + cmd, { method: 'POST' }).then((r) => r.json()),
  heartbeat: () => fetch('/heartbeat', { method: 'POST' }),
};
