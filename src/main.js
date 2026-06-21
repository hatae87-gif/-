/*
 * main.js — 패널 UI 동작 연결
 */

const cut = require("./lib/cut");
const captions = require("./lib/captions");
const assets = require("./lib/assets");
const { describeApi, hostInfo } = require("./lib/ppro");

const $ = (sel) => document.querySelector(sel);

// ---- 로그 ----
const logEl = $("#log");
function nowHHMMSS() {
  // UXP는 toLocaleTimeString 로케일 인자 지원이 불안정 → 직접 포맷
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function log(msg, kind = "") {
  try {
    const line = document.createElement("div");
    if (kind) line.className = kind;
    line.textContent = `[${nowHHMMSS()}] ${msg}`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  } catch (_) {
    // 로그 출력 자체가 실패해도 앱이 멈추지 않도록 무시
  }
}
const ok = (m) => log(m, "ok");
const err = (m) => log("⚠ " + m, "err");

// 비동기 핸들러를 안전하게 감싸기 (에러를 로그로)
function guard(fn) {
  return async () => {
    try {
      await fn();
    } catch (e) {
      err(e && e.message ? e.message : String(e));
    }
  };
}

// ---- 탭 전환 ----
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const name = tab.dataset.tab;
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("hidden", p.dataset.panel !== name);
    });
  });
});

// ---- 컷 편집 ----
$("#btn-cut-tc").addEventListener("click", guard(async () => {
  const res = await cut.addMarkersFromTimecodes($("#cut-tc").value);
  ok(res.message);
}));
$("#btn-cut-srt").addEventListener("click", guard(async () => {
  const res = await cut.addMarkersFromSrt($("#cut-tc").value);
  ok(res.message);
}));
$("#btn-cut-list").addEventListener("click", guard(async () => {
  log("현재 마커:\n" + (await cut.listMarkers()));
}));

// ---- 자막 ----
function capOpts() {
  return {
    cps: Number($("#cap-cps").value) || 14,
    min: Number($("#cap-min").value) || 1.2,
  };
}
$("#btn-cap-preview").addEventListener("click", guard(async () => {
  const pre = $("#cap-preview");
  pre.textContent = captions.previewSrt($("#cap-text").value, capOpts());
  pre.classList.remove("hidden");
}));
$("#btn-cap-save").addEventListener("click", guard(async () => {
  const res = await captions.saveTextAsSrt($("#cap-text").value, capOpts());
  res.saved ? ok(res.message) : log(res.message);
}));
$("#btn-cap-track").addEventListener("click", guard(async () => {
  const res = await captions.textToCaptionTrack($("#cap-text").value, capOpts());
  res.ok ? ok(res.message) : err(res.message);
}));
$("#btn-cap-import").addEventListener("click", guard(async () => {
  const res = await captions.importSrtAsCaptionTrack({});
  res.ok ? ok(res.message) : err(res.message);
}));

// ---- 에셋 ----
$("#btn-as-files").addEventListener("click", guard(async () => {
  const binName = $("#as-bin").value.trim() || undefined;
  const res = await assets.pickAndImportFiles({ binName });
  res.imported ? ok(res.message) : log(res.message);
}));
$("#btn-as-folder").addEventListener("click", guard(async () => {
  const res = await assets.pickAndImportFolder({ classify: false });
  res.imported ? ok(res.message) : log(res.message);
}));
$("#btn-as-classify").addEventListener("click", guard(async () => {
  const res = await assets.pickAndImportFolder({ classify: true });
  res.imported ? ok(res.message) : log(res.message);
}));

// ---- 진단/유틸 ----
$("#btn-diag").addEventListener("click", guard(async () => {
  log("환경 점검 중...");
  log(await describeApi());
}));
$("#btn-clear").addEventListener("click", () => {
  logEl.innerHTML = "";
});

// 초기화
$("#host").textContent = hostInfo();
log("패널 준비 완료. 탭에서 작업을 선택하세요.");
