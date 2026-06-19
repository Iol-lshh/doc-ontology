'use strict';

// CliCommandController (ADR 0011·0013).
// CLI 진입점이자 어댑터: argv 파싱 + 콘솔 출력. Facade를 직접 호출한다(단명 프로세스).
// 명령 로직은 갖지 않는다 — Facade로 위임한다.

const buildFacade = require('./facade/build-facade.js');
const rollbackFacade = require('./facade/rollback-facade.js');

const COMMANDS = ['build-ontology', 'rollback', 'find'];

function runBuild() {
  const result = buildFacade.build();
  if (result.ok) {
    console.log(`빌드 성공 — 노드 ${result.nodeCount}, 엣지 ${result.edgeCount}`);
    process.exit(0);
  }
  console.error(`빌드 실패 — 검증 ${result.errors.length}건 (인덱스 미갱신, ADR 0008)`);
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}

// rollback [세대] — 인자 없으면 빌드 롤백(직전 여벌), 있으면 히스토리 롤백(해당 세대).
function runRollback(generation) {
  const result = generation ? rollbackFacade.historyRollback(generation) : rollbackFacade.buildRollback();
  if (result.ok) {
    const what = result.kind === 'history' ? `세대 ${result.generation}` : '직전 여벌';
    console.log(`롤백 성공 — ${what}로 복구`);
    process.exit(0);
  }
  console.error(`롤백 실패 — ${result.error}`);
  process.exit(1);
}

function main() {
  const [, , command, arg] = process.argv;

  if (!COMMANDS.includes(command)) {
    console.error(`알 수 없는 명령: ${command}`);
    console.error(`사용 가능: ${COMMANDS.join(', ')}, gui`);
    process.exit(2);
  }

  if (command === 'build-ontology') return runBuild();
  if (command === 'rollback') return runRollback(arg);

  // find는 해당 Facade 연결 예정.
  console.error(`'${command}' 아직 미구현 (Facade 연결 예정).`);
  process.exit(1);
}

main();
