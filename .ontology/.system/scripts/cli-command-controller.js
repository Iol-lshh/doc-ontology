'use strict';

// CliCommandController (ADR 0011·0013).
// CLI 진입점이자 어댑터: argv 파싱 + 콘솔 출력. Facade를 직접 호출한다(단명 프로세스).
// 명령 로직은 갖지 않는다 — Facade로 위임한다.

const readline = require('node:readline');
const buildFacade = require('./facade/build-facade.js');
const saveFacade = require('./facade/save-facade.js');
const checkoutFacade = require('./facade/checkout-facade.js');
const restoreFacade = require('./facade/restore-facade.js');
const resetFacade = require('./facade/reset-facade.js');
const removeAllFacade = require('./facade/remove-all-facade.js');
const diffFacade = require('./facade/diff-facade.js');

const COMMANDS = ['build-ontology', 'save', 'checkout', 'restore', 'reset', 'remove-all', 'find', 'diff'];

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

// checkout <세대> — 작업본+유저 DB를 그 세대 구조로 옮김(HEAD 이동, TIP·backup 불변).
function runCheckout(generation) {
  const result = checkoutFacade.checkout(generation);
  if (result.ok) {
    console.log(`체크 — 작업본·유저 DB를 세대 ${result.generation.slice(0, 12)}로 (HEAD 이동, 끝 버리려면 reset)`);
    process.exit(0);
  }
  console.error(`checkout 실패 — ${result.error}`);
  process.exit(1);
}

// restore(초기화) — 작업본+유저 DB를 backup(마지막 저장)으로 되돌림. 히스토리·backup 불변.
function runRestore() {
  const result = restoreFacade.restore();
  if (result.ok) {
    console.log('초기화 — 작업본·유저 DB를 backup(마지막 저장)으로 되돌림');
    process.exit(0);
  }
  console.error(`restore 실패 — ${result.error}`);
  process.exit(1);
}

// remove-all(데이터 비우기) — 온톨로지를 완전히 비운다(database·.system·history·backup). 되돌릴 수 없어 확인을 받는다.
// 비대화식 실행은 `remove-all --confirm`(또는 yes)로 프롬프트를 건너뛴다.
function runRemoveAll(arg) {
  const doIt = () => {
    removeAllFacade.removeAll();
    console.log('데이터 비우기 완료 — database·.system·히스토리·backup 모두 비움. (build-ontology로 새로 시작)');
    process.exit(0);
  };
  if (arg === '--confirm' || arg === '--yes' || arg === 'yes') return doIt();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('⚠ 정말 전부 비웁니까? database·시스템·히스토리·backup이 모두 삭제되어 되돌릴 수 없습니다. 진행하려면 yes 입력 > ', (ans) => {
    rl.close();
    if (ans.trim().toLowerCase() === 'yes') doIt();
    else {
      console.log('취소됨 — 아무것도 삭제하지 않았습니다.');
      process.exit(0);
    }
  });
}

// reset — 현재 HEAD 이후 세대를 버림(TIP=HEAD). 유저 DB·backup 불변.
function runReset() {
  const result = resetFacade.reset();
  if (result.ok) {
    console.log(`리셋 — 끝을 세대 ${result.generation.slice(0, 12)}로 당김(이후 세대 폐기)`);
    process.exit(0);
  }
  console.error(`reset 실패 — ${result.error}`);
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
  if (command === 'checkout') return runCheckout(arg);
  if (command === 'restore') return runRestore();
  if (command === 'reset') return runReset();
  if (command === 'remove-all') return runRemoveAll(arg);
  if (command === 'diff') return runDiff(arg, arg2);

  // find는 해당 Facade 연결 예정.
  console.error(`'${command}' 아직 미구현 (Facade 연결 예정).`);
  process.exit(1);
}

main();
