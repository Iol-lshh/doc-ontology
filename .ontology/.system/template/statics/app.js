// 진입점. 뷰 컴포넌트를 등록(import)하고, 탭 전환·명령·하트비트를 묶는다.

import './components/file-path-view.js';
import './components/graph-view.js';
import './components/history-view.js';
import './components/document-view.js';
import './components/diff-view.js';
import { api } from './api.js';

const log = (m) => { document.getElementById('log').textContent = m; };

// 탭 전환 — 해당 탭의 뷰 컴포넌트를 다시 로드한다.
function activate(tab) {
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('active', s.dataset.tab === tab));
  const view = document.querySelector(`.tab[data-tab="${tab}"] [data-view]`);
  if (view && view.load) view.load();
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (btn) activate(btn.dataset.tab);
});

// 노드 열기 — 컴포넌트가 띄운 node-open을 받아 본문 탭으로 전환 후 로드(컴포넌트 간 통신).
document.addEventListener('node-open', (e) => {
  activate('document');
  document.querySelector('document-view').open(e.detail.id);
});

// 명령 버튼 — 빌드 성공 시 현재 활성 탭을 갱신.
document.querySelectorAll('.actions button').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const cmd = btn.dataset.cmd;
    try {
      const data = await api.command(cmd);
      log(cmd + ': ' + JSON.stringify(data));
      // build·save·restore·reset 후 현재 탭을 다시 로드(작업본·세대가 바뀜).
      if (data.ok !== false) {
        activate(document.querySelector('nav button.active').dataset.tab);
      }
    } catch (err) {
      log(cmd + ' 실패: ' + err.message);
    }
  });
});

// 하트비트 — 탭이 살아있는 동안 주기적 ping. 끊기면 서버가 self-exit (ADR 0011).
const status = document.getElementById('status');
async function beat() {
  try {
    await api.heartbeat();
    status.textContent = '연결됨';
    status.className = 'live';
  } catch {
    status.textContent = '서버 연결 끊김';
    status.className = 'dead';
  }
}
beat();
setInterval(beat, 3000);
