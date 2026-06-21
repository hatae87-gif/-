/*
 * srt.js — SRT 자막 파싱/생성 유틸리티 (순수 함수, Premiere API 의존 없음)
 *
 * 외부 API에 의존하지 않으므로 Node 환경에서도 그대로 단위 테스트가 가능합니다.
 * (test/srt.test.js 참고)
 */

/** "00:00:01,250" 또는 "00:00:01.250" → 초(seconds, float) */
function timecodeToSeconds(tc) {
  const m = String(tc).trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!m) throw new Error(`잘못된 타임코드: "${tc}"`);
  const [, hh, mm, ss, ms] = m;
  return (
    Number(hh) * 3600 +
    Number(mm) * 60 +
    Number(ss) +
    Number(ms.padEnd(3, "0")) / 1000
  );
}

/** 초(seconds) → "00:00:01,250" (SRT 표준: 콤마 구분) */
function secondsToTimecode(seconds) {
  if (seconds < 0) seconds = 0;
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  let total = Math.floor(seconds);
  const hh = Math.floor(total / 3600);
  total %= 3600;
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)},${p(ms, 3)}`;
}

/**
 * SRT 문자열 → [{ index, start, end, text }] (start/end 는 초 단위)
 */
function parseSrt(content) {
  const cues = [];
  // CRLF/CR 정규화 후 빈 줄 기준으로 블록 분리
  const blocks = String(content)
    .replace(/\r\n?/g, "\n")
    .replace(/^﻿/, "") // BOM 제거
    .trim()
    .split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    // 첫 줄이 숫자(인덱스)면 건너뜀
    let i = 0;
    let index = cues.length + 1;
    if (/^\d+$/.test(lines[0].trim())) {
      index = Number(lines[0].trim());
      i = 1;
    }

    const timeLine = lines[i];
    const tm = timeLine && timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/
    );
    if (!tm) continue;

    const start = timecodeToSeconds(tm[1]);
    const end = timecodeToSeconds(tm[2]);
    const text = lines.slice(i + 1).join("\n").trim();
    cues.push({ index, start, end, text });
  }
  return cues;
}

/**
 * [{ start, end, text }] → SRT 문자열
 */
function buildSrt(cues) {
  return (
    cues
      .map((c, i) => {
        const idx = c.index != null ? c.index : i + 1;
        return `${idx}\n${secondsToTimecode(c.start)} --> ${secondsToTimecode(
          c.end
        )}\n${(c.text || "").trim()}`;
      })
      .join("\n\n") + "\n"
  );
}

/**
 * 평문 텍스트(줄/문장 단위) → 자막 큐 자동 분배.
 * 영상 길이를 모를 때 임시로 시간을 균등 배분하거나, 글자수 기반으로 길이를 추정합니다.
 *
 * @param {string} text                여러 줄 텍스트(빈 줄로 문단 구분도 인식)
 * @param {object} [opts]
 * @param {number} [opts.startAt=0]    첫 자막 시작 시간(초)
 * @param {number} [opts.cps=14]       초당 글자 수(읽기 속도). 한국어 12~16 권장
 * @param {number} [opts.min=1.2]      자막 최소 노출 시간(초)
 * @param {number} [opts.gap=0.08]     자막 사이 간격(초)
 */
function textToCues(text, opts = {}) {
  const { startAt = 0, cps = 14, min = 1.2, gap = 0.08 } = opts;
  const lines = String(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const cues = [];
  let t = startAt;
  lines.forEach((line, i) => {
    const dur = Math.max(min, line.replace(/\s/g, "").length / cps);
    cues.push({ index: i + 1, start: t, end: t + dur, text: line });
    t += dur + gap;
  });
  return cues;
}

module.exports = {
  timecodeToSeconds,
  secondsToTimecode,
  parseSrt,
  buildSrt,
  textToCues,
};
