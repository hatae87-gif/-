/*
 * cut.js — 컷 편집 자동화 (마커 기반)
 *
 * UXP Premiere에서 가장 안정적으로 자동화할 수 있는 컷 작업은 '시퀀스 마커'입니다.
 * 대본/타임코드 목록/SRT를 받아 컷 지점마다 마커를 찍어두면, 타임라인에서
 * 마커를 기준으로 일관되게 잘라 편집할 수 있습니다.
 *
 * (razorAtMarkers 는 버전에 따라 동작하지 않을 수 있는 실험적 기능으로 분리해 두었습니다.)
 */

const { ppro, getSequence, getFrameRate, snapToFrame } = require("./ppro");
const { parseSrt, timecodeToSeconds } = require("./srt");

/** 초(seconds) → UXP TickTime 객체 (버전별 생성자 차이 흡수) */
function tickTime(seconds) {
  const app = ppro();
  const T = app.TickTime;
  if (T) {
    if (typeof T.createWithSeconds === "function") return T.createWithSeconds(seconds);
    if (typeof T.TIME_FROM_SECONDS === "function") return T.TIME_FROM_SECONDS(seconds);
  }
  // 폴백: 숫자 그대로(일부 API는 초 단위 number도 허용)
  return seconds;
}

/** 활성 시퀀스의 Markers 객체 얻기 (버전별 위치 차이 흡수) */
async function getMarkers(sequence) {
  const app = ppro();
  if (app.Markers && typeof app.Markers.getMarkers === "function") {
    return await app.Markers.getMarkers(sequence);
  }
  if (typeof sequence.getMarkers === "function") return await sequence.getMarkers();
  throw new Error("이 Premiere 버전에서 Markers API를 찾을 수 없습니다.");
}

/** 마커 1개 생성 (시그니처 차이를 순서대로 시도) */
async function createOneMarker(markers, seconds, name = "") {
  const t = tickTime(seconds);
  const attempts = [
    () => markers.createMarker(name, t),
    () => markers.createMarker(t, name),
    () => markers.createMarker(t),
    () => markers.createMarker(name, t, tickTime(0)),
  ];
  let lastErr;
  for (const fn of attempts) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("마커 생성 실패");
}

/**
 * 초 단위 시간 배열을 받아 활성 시퀀스에 마커를 일괄 생성.
 * @param {Array<{time:number, name?:string}>} points
 */
async function addMarkersAtTimes(points) {
  const sequence = await getSequence();
  const markers = await getMarkers(sequence);
  const fps = await getFrameRate(sequence); // 26+ 에서만 >0, 그 외엔 0(스냅 생략)
  let count = 0;
  for (const p of points) {
    await createOneMarker(markers, snapToFrame(p.time, fps), p.name || "");
    count++;
  }
  const snapNote = fps ? ` (${fps.toFixed(2)}fps 프레임 스냅)` : "";
  return { count, message: `${count}개 마커를 시퀀스에 추가했습니다.${snapNote}` };
}

/**
 * 여러 줄 타임코드 텍스트 → 마커.
 * 각 줄은 "00:00:12,500" 또는 "00:00:12.5" 또는 "00:00:12,500  컷이름" 형식.
 */
async function addMarkersFromTimecodes(text) {
  const points = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d{1,2}:\d{2}:\d{2}(?:[,.]\d{1,3})?)\s*(.*)$/);
    if (!m) continue;
    const tc = m[1].includes(",") || m[1].includes(".") ? m[1] : m[1] + ",000";
    points.push({ time: timecodeToSeconds(tc), name: m[2] || "" });
  }
  if (!points.length) throw new Error("인식된 타임코드가 없습니다. (예: 00:00:12,500 장면전환)");
  return addMarkersAtTimes(points);
}

/** SRT 파일 텍스트 → 각 자막 시작 지점에 마커 (컷 가이드용) */
async function addMarkersFromSrt(srtContent) {
  const cues = parseSrt(srtContent);
  if (!cues.length) throw new Error("SRT에서 자막을 찾지 못했습니다.");
  const points = cues.map((c) => ({
    time: c.start,
    name: (c.text || "").split("\n")[0].slice(0, 24),
  }));
  return addMarkersAtTimes(points);
}

/** 현재 시퀀스의 마커 목록을 사람이 읽을 수 있는 문자열로 */
async function listMarkers() {
  const { secondsToTimecode } = require("./srt");
  const sequence = await getSequence();
  const markers = await getMarkers(sequence);

  let arr = [];
  if (typeof markers.getMarkers === "function") arr = await markers.getMarkers();
  else if (Array.isArray(markers)) arr = markers;

  if (!arr.length) return "마커가 없습니다.";
  const lines = [];
  for (const mk of arr) {
    let secs = 0;
    try {
      const start = typeof mk.getStart === "function" ? await mk.getStart() : mk.start;
      secs = start && start.seconds != null ? start.seconds : Number(start) || 0;
    } catch (_) {}
    const name = (typeof mk.getName === "function" ? await mk.getName() : mk.name) || "";
    lines.push(`${secondsToTimecode(secs)}  ${name}`.trim());
  }
  return lines.join("\n");
}

module.exports = {
  addMarkersAtTimes,
  addMarkersFromTimecodes,
  addMarkersFromSrt,
  listMarkers,
};
