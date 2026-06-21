/*
 * captions.js — 자막/캡션 생성
 *  - 텍스트(대본) → SRT 자동 타이밍 → 파일로 저장
 *  - SRT 파일을 프로젝트로 임포트하고 활성 시퀀스에 캡션 트랙 생성
 *
 * 참고: 현재 UXP Premiere의 캡션 '내용' 직접 편집 API는 제한적입니다.
 *       따라서 표준 SRT 파일을 만들어 임포트 → createCaptionTrack 하는 방식을 사용합니다.
 */

const { ppro, getProject, getSequence, getRootItem } = require("./ppro");
const { buildSrt, parseSrt, textToCues } = require("./srt");
const { storage } = require("uxp");
const fs = storage.localFileSystem;

/**
 * 대본 텍스트를 SRT로 변환해 파일로 저장.
 * @returns 저장된 파일 entry (또는 null)
 */
async function saveTextAsSrt(text, opts = {}) {
  const cues = textToCues(text, opts);
  if (!cues.length) throw new Error("자막으로 만들 텍스트가 없습니다.");
  const srt = buildSrt(cues);

  const file = await fs.getFileForSaving("자막.srt", {
    types: ["srt"],
  });
  if (!file) return { saved: false, message: "저장이 취소되었습니다." };
  await file.write(srt, { format: storage.formats.utf8 });
  return { saved: true, file, cueCount: cues.length, message: `${cues.length}개 자막 저장: ${file.name}` };
}

/** 텍스트 → SRT 미리보기(파일 저장 없이 문자열만) */
function previewSrt(text, opts = {}) {
  return buildSrt(textToCues(text, opts));
}

/**
 * SRT 파일을 임포트하고 활성 시퀀스에 캡션 트랙으로 추가.
 * @param {object} [opts]
 * @param {storage.File} [opts.file]  미리 만든 파일 entry (없으면 사용자가 선택)
 */
async function importSrtAsCaptionTrack({ file } = {}) {
  const srtFile = file || (await fs.getFileForOpening({ types: ["srt", "vtt"] }));
  if (!srtFile) return { ok: false, message: "선택된 SRT 파일이 없습니다." };

  const project = await getProject();
  const sequence = await getSequence();

  const ok = await project.importFiles([srtFile.nativePath], true);
  if (!ok) return { ok: false, message: "SRT 임포트에 실패했습니다." };

  const item = await findItemByName(project, srtFile.name);
  if (!item)
    return {
      ok: false,
      message: "임포트는 됐지만 프로젝트에서 SRT 항목을 찾지 못했습니다. (프로젝트 패널에서 수동으로 캡션을 추가해주세요)",
    };

  if (typeof sequence.createCaptionTrack !== "function") {
    return {
      ok: false,
      message:
        "이 Premiere 버전에는 createCaptionTrack API가 없습니다. SRT는 임포트되었으니 타임라인으로 직접 끌어다 놓으세요.",
    };
  }

  // 포맷 상수는 버전에 따라 Sequence 또는 모듈에 위치할 수 있어 안전하게 탐색
  const app = ppro();
  const fmt =
    (app.Sequence && app.Sequence.CAPTION_FORMAT_SRT) ??
    (app.Constants && app.Constants.CaptionFormat && app.Constants.CaptionFormat.SRT) ??
    undefined;

  const created = await sequence.createCaptionTrack(item, 0, fmt);
  return {
    ok: !!created,
    message: created
      ? "캡션 트랙을 시퀀스에 추가했습니다."
      : "캡션 트랙 생성에 실패했습니다. (SRT는 임포트됨)",
  };
}

/** 대본 텍스트 → SRT 저장 → 캡션 트랙 생성까지 한 번에 */
async function textToCaptionTrack(text, opts = {}) {
  const saved = await saveTextAsSrt(text, opts);
  if (!saved.saved) return { ok: false, message: saved.message };
  const res = await importSrtAsCaptionTrack({ file: saved.file });
  return { ok: res.ok, message: `${saved.message} / ${res.message}` };
}

/** 루트 빈을 훑어 이름이 일치하는 프로젝트 항목 찾기 */
async function findItemByName(project, name) {
  const root = await getRootItem(project);
  if (typeof root.getItems !== "function") return null;
  const stack = [...(await root.getItems())];
  while (stack.length) {
    const it = stack.pop();
    const itName = typeof it.getName === "function" ? await it.getName() : it.name;
    if (itName === name) return it;
    if (typeof it.getItems === "function") {
      try {
        stack.push(...(await it.getItems()));
      } catch (_) {}
    }
  }
  return null;
}

module.exports = {
  saveTextAsSrt,
  previewSrt,
  importSrtAsCaptionTrack,
  textToCaptionTrack,
  parseSrt,
};
