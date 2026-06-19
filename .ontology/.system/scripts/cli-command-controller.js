'use strict';

// CliCommandController (ADR 0011·0013).
// CLI 진입점이자 어댑터: argv 파싱 + 콘솔 출력. Facade를 직접 호출한다(단명 프로세스).
// 명령 로직은 갖지 않는다 — Facade로 위임한다.

const buildFacade = require('./facade/build-facade.js');
const saveFacade = require('./facade/save-facade.js');
const revertFacade = require('./facade/revert-facade.js');
const diffFacade = require('./facade/diff-facade.js');

const COMMANDS = ['build-ontology', 'save', 'revert', 'find', 'diff'];

function runBuild() {
  const result = buildFacade.build();
  if (result.ok) {
    console.log(`빌드 성공 — 노드 ${result.nodeCount}, 엣지 ${result.edgeCount} (작업본 갱신, save로 보존)`);
    process.exit(0);
  }
  console.error(`빌드 실패 — 검증 ${result.errors.length}건 (작업본 미갱신, ADR 0008)`);
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}

// save — 현재 작업본을 보존(세대 적재 + 직전 저장본을 backup으로).
function runSave() {
  const result = saveFacade.save();
  if (result.unchanged) console.log('저장 — 직전 세대와 동일, 새 세대 없음');
  else console.log(`저장 성공 — 세대 ${result.generation ? result.generation.slice(0, 12) : '(history off)'}`);
  process.exit(0);
}

// revert <세대> — 작업본을 그 세대로 되돌림(저장 안 함, backup·히스토리 불변).
function runRevert(generation) {
  const result = revertFacade.revert(generation);
  if (result.ok) {
    console.log(`되돌림 — 작업본을 세대 ${result.generation.slice(0, 12)}로 (저장하려면 save)`);
    process.exit(0);
  }
  console.error(`revert 실패 — ${result.error}`);
  process.exit(1);
}

// diff <from> <to> — 대상은 세대 sha / current / backup. 그래프·파일 변경 요약 출력.
function runDiff(from, to) {
  const result = diffFacade.diff(from, to);
  if (!result.ok) {
    console.error(`diff 실패 — ${result.error}`);
    process.exit(1);
  }
  const g = result.graph;
  console.log(`diff ${from} → ${to}`);
  console.log(`  노드: +${g.nodes.added.length} -${g.nodes.removed.length} ~${g.nodes.changed.length}`);
  console.log(`  엣지: +${g.edges.added.length} -${g.edges.removed.length}`);
  console.log(`  파일: +${result.files.added.length} -${result.files.removed.length} ~${result.files.modified.length}`);
  for (const n of g.nodes.added) console.log(`    + ${n.type} ${n.label}`);
  for (const n of g.nodes.removed) console.log(`    - ${n.type} ${n.label}`);
  for (const n of g.nodes.changed) console.log(`    ~ ${n.to.type} ${n.to.label}`);
  process.exit(0);
}

function main() {
  const [, , command, arg, arg2] = process.argv;

  if (!COMMANDS.includes(command)) {
    console.error(`알 수 없는 명령: ${command}`);
    console.error(`사용 가능: ${COMMANDS.join(', ')}, gui`);
    process.exit(2);
  }

  if (command === 'build-ontology') return runBuild();
  if (command === 'save') return runSave();
  if (command === 'revert') return runRevert(arg);
  if (command === 'diff') return runDiff(arg, arg2);

  // find는 해당 Facade 연결 예정.
  console.error(`'${command}' 아직 미구현 (Facade 연결 예정).`);
  process.exit(1);
}

main();
