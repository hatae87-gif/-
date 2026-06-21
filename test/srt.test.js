/*
 * srt.test.js — 순수 SRT 로직 테스트 (Node 내장 test 러너, 의존성 없음)
 * 실행: npm test
 */
const test = require("node:test");
const assert = require("node:assert");
const {
  timecodeToSeconds,
  secondsToTimecode,
  parseSrt,
  buildSrt,
  textToCues,
} = require("../src/lib/srt");

test("timecode <-> seconds 왕복", () => {
  assert.strictEqual(timecodeToSeconds("00:00:01,250"), 1.25);
  assert.strictEqual(timecodeToSeconds("01:02:03,000"), 3723);
  assert.strictEqual(secondsToTimecode(1.25), "00:00:01,250");
  assert.strictEqual(secondsToTimecode(3723), "01:02:03,000");
});

test("점(.) 구분 타임코드도 허용", () => {
  assert.strictEqual(timecodeToSeconds("00:00:02.5"), 2.5);
});

test("SRT 파싱", () => {
  const srt = `1
00:00:01,000 --> 00:00:04,000
첫 줄

2
00:00:05,000 --> 00:00:07,500
둘째 줄
이어진 줄`;
  const cues = parseSrt(srt);
  assert.strictEqual(cues.length, 2);
  assert.strictEqual(cues[0].start, 1);
  assert.strictEqual(cues[0].end, 4);
  assert.strictEqual(cues[0].text, "첫 줄");
  assert.strictEqual(cues[1].text, "둘째 줄\n이어진 줄");
});

test("buildSrt 는 parseSrt 와 왕복 가능", () => {
  const cues = [
    { start: 1, end: 4, text: "a" },
    { start: 5, end: 7.5, text: "b" },
  ];
  const round = parseSrt(buildSrt(cues));
  assert.strictEqual(round.length, 2);
  assert.strictEqual(round[1].end, 7.5);
});

test("textToCues 는 읽기속도에 따라 길이 배분", () => {
  const cues = textToCues("가나다라마바사아\n짧다", { cps: 8, min: 1, gap: 0 });
  assert.strictEqual(cues.length, 2);
  assert.strictEqual(cues[0].start, 0);
  assert.strictEqual(cues[0].end, 1); // 8글자 / 8cps = 1초
  assert.strictEqual(cues[1].start, 1); // 앞 자막 끝에서 시작
  assert.strictEqual(cues[1].end, 2); // "짧다"=2글자지만 min=1초
});

test("빈 텍스트는 빈 큐", () => {
  assert.strictEqual(textToCues("   \n  \n").length, 0);
});
