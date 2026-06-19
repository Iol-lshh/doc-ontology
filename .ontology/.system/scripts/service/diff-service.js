'use strict';

// diff-service (ADR 0012). 두 텍스트의 줄 단위 diff를 LCS로 계산한다.
// 반환: [{ op: 'keep'|'add'|'del', text }] 시퀀스. 외부 의존 없음.
// 단일 책임: 줄 diff 계산. 무엇을 비교할지(파일 짝)는 DiffFacade가 정한다.

function lineDiff(beforeText, afterText) {
  const a = beforeText.length ? beforeText.split('\n') : [];
  const b = afterText.length ? afterText.split('\n') : [];
  const n = a.length;
  const m = b.length;

  // LCS 길이 표 (n+1)x(m+1)
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // 역추적해 시퀀스 구성
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: 'keep', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: 'del', text: a[i] });
      i++;
    } else {
      out.push({ op: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: 'del', text: a[i++] });
  while (j < m) out.push({ op: 'add', text: b[j++] });
  return out;
}

module.exports = { lineDiff };
