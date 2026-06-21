/*
 * assets.js — 에셋/파일 일괄 관리
 *  - 여러 파일 한 번에 임포트
 *  - 폴더를 통째로 임포트하면서 폴더 이름의 빈(bin)으로 정리
 *  - 확장자 기준 자동 분류(빈 생성)
 */

const { ppro, getProject, getRootItem } = require("./ppro");
const { storage } = require("uxp");
const fs = storage.localFileSystem;

// 영상 작업에서 자주 쓰는 미디어 확장자
const MEDIA_EXT = new Set([
  "mp4", "mov", "mxf", "avi", "mkv", "m4v", "mpg", "mpeg", "wmv", "webm",
  "wav", "mp3", "aac", "aif", "aiff", "m4a", "flac",
  "png", "jpg", "jpeg", "tif", "tiff", "psd", "ai", "gif", "exr",
  "srt", "vtt",
]);

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** 사용자가 선택한 여러 파일을 임포트. 옵션으로 새 빈에 담음. */
async function pickAndImportFiles({ binName } = {}) {
  const files = await fs.getFileForOpening({ allowMultiple: true });
  const list = Array.isArray(files) ? files : files ? [files] : [];
  if (!list.length) return { imported: 0, message: "선택된 파일이 없습니다." };

  const paths = list.map((f) => f.nativePath);
  const project = await getProject();
  const targetBin = binName ? await ensureBin(project, binName) : undefined;

  const ok = await project.importFiles(paths, true, targetBin);
  return {
    imported: ok ? paths.length : 0,
    message: ok
      ? `${paths.length}개 파일 임포트 완료${binName ? ` → '${binName}' 빈` : ""}`
      : "임포트에 실패했습니다.",
  };
}

/** 폴더 하나를 선택해 그 안의 미디어 파일을 폴더명 빈으로 임포트. */
async function pickAndImportFolder({ classify = false } = {}) {
  const folder = await fs.getFolder();
  if (!folder) return { imported: 0, message: "선택된 폴더가 없습니다." };

  const entries = await folder.getEntries();
  const mediaFiles = entries.filter((e) => e.isFile && MEDIA_EXT.has(extOf(e.name)));
  if (!mediaFiles.length)
    return { imported: 0, message: "폴더에 임포트할 미디어 파일이 없습니다." };

  const project = await getProject();

  if (!classify) {
    const bin = await ensureBin(project, folder.name);
    const ok = await project.importFiles(
      mediaFiles.map((f) => f.nativePath),
      true,
      bin
    );
    return {
      imported: ok ? mediaFiles.length : 0,
      message: ok
        ? `${mediaFiles.length}개 파일 임포트 → '${folder.name}' 빈`
        : "임포트 실패",
    };
  }

  // 종류별(영상/오디오/이미지/자막)로 빈을 나눠 임포트
  const groups = { 영상: [], 오디오: [], 이미지: [], 자막: [], 기타: [] };
  const kindOf = (ext) => {
    if (["mp4", "mov", "mxf", "avi", "mkv", "m4v", "mpg", "mpeg", "wmv", "webm"].includes(ext)) return "영상";
    if (["wav", "mp3", "aac", "aif", "aiff", "m4a", "flac"].includes(ext)) return "오디오";
    if (["png", "jpg", "jpeg", "tif", "tiff", "psd", "ai", "gif", "exr"].includes(ext)) return "이미지";
    if (["srt", "vtt"].includes(ext)) return "자막";
    return "기타";
  };
  for (const f of mediaFiles) groups[kindOf(extOf(f.name))].push(f.nativePath);

  let total = 0;
  const parts = [];
  for (const [kind, paths] of Object.entries(groups)) {
    if (!paths.length) continue;
    const bin = await ensureBin(project, `${folder.name} - ${kind}`);
    const ok = await project.importFiles(paths, true, bin);
    if (ok) total += paths.length;
    parts.push(`${kind} ${paths.length}`);
  }
  return { imported: total, message: `분류 임포트 완료 (${parts.join(", ")})` };
}

/**
 * 같은 이름의 빈이 있으면 재사용, 없으면 루트에 생성.
 * 버전별 createBin 시그니처 차이를 흡수합니다.
 */
async function ensureBin(project, name) {
  const root = await getRootItem(project);

  // 기존 빈 찾기
  if (typeof root.getItems === "function") {
    const items = await root.getItems();
    for (const it of items) {
      const itName = typeof it.getName === "function" ? await it.getName() : it.name;
      const isBin = typeof it.isBin === "function" ? await it.isBin() : undefined;
      if (itName === name && (isBin === undefined || isBin)) return it;
    }
  }

  // 새 빈 생성 (가능한 시그니처들을 순서대로 시도)
  if (typeof root.createBin === "function") {
    return await root.createBin(name);
  }
  if (typeof project.createBin === "function") {
    return await project.createBin(name, root);
  }
  // 빈 생성 API가 없으면 루트에 그대로 임포트
  return undefined;
}

module.exports = { pickAndImportFiles, pickAndImportFolder, ensureBin, MEDIA_EXT };
