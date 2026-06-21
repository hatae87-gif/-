/*
 * ppro.js — premierepro UXP API 래퍼 + 안전 접근/진단 헬퍼
 *
 * UXP for Premiere Pro API는 버전마다 메서드가 추가/변경됩니다.
 * 이 래퍼는 (1) 자주 쓰는 진입점을 한곳에 모으고,
 *          (2) 메서드가 없을 때 명확한 에러 메시지를 던지며,
 *          (3) describeApi()로 현재 설치된 버전의 API를 점검할 수 있게 합니다.
 *
 * 참고 문서:
 *   - https://developer.adobe.com/premiere-pro/uxp/ppro-reference/
 *   - https://github.com/AdobeDocs/uxp-premiere-pro-samples
 */

let _ppro = null;
function ppro() {
  if (!_ppro) {
    try {
      _ppro = require("premierepro");
    } catch (e) {
      throw new Error(
        "'premierepro' 모듈을 불러올 수 없습니다. Premiere Pro 안에서 (UXP 패널로) 실행 중인지 확인하세요."
      );
    }
  }
  return _ppro;
}

/** 현재 활성 프로젝트 반환 (없으면 에러) */
async function getProject() {
  const app = ppro();
  const project = await app.Project.getActiveProject();
  if (!project) throw new Error("열려 있는 프로젝트가 없습니다. 프로젝트를 먼저 열어주세요.");
  return project;
}

/** 현재 활성 시퀀스 반환 (없으면 에러) */
async function getSequence() {
  const project = await getProject();
  const seq = await project.getActiveSequence();
  if (!seq) throw new Error("활성 시퀀스가 없습니다. 타임라인에서 시퀀스를 열어주세요.");
  return seq;
}

/** 프로젝트 루트 빈(폴더) 반환. 버전별 메서드 차이를 흡수합니다. */
async function getRootItem(project) {
  project = project || (await getProject());
  if (typeof project.getRootItem === "function") return await project.getRootItem();
  if (project.rootItem) return project.rootItem;
  throw new Error("rootItem 접근 API를 찾을 수 없습니다. describeApi()로 확인하세요.");
}

/**
 * 트랜잭션(편집 액션) 실행 래퍼.
 * UXP Premiere의 편집은 project.executeTransaction(cb) 안에서 액션을 추가하는 모델입니다.
 *
 * @param {function} build  (compoundAction, ppro, project) => void  — 액션을 compoundAction에 추가
 * @param {string}   undoString  실행 취소 히스토리에 표시될 이름
 */
async function runTransaction(build, undoString = "FFP 워크플로우") {
  const app = ppro();
  const project = await getProject();
  if (typeof project.executeTransaction !== "function") {
    throw new Error(
      "executeTransaction API가 없습니다. 이 Premiere 버전에서는 편집 액션을 지원하지 않을 수 있습니다."
    );
  }
  return await project.executeTransaction((compoundAction) => {
    build(compoundAction, app, project);
  }, undoString);
}

/**
 * describeApi — 설치된 premierepro/UXP 버전에서 사용 가능한 주요 객체/메서드를 점검합니다.
 * 패널의 '환경 점검' 버튼이 이 결과를 출력합니다. 새 기능을 붙일 때 어떤 메서드가
 * 실제로 존재하는지 빠르게 확인하는 용도입니다.
 */
async function describeApi() {
  const out = [];
  const log = (s) => out.push(s);
  try {
    const app = ppro();
    log("✓ premierepro 모듈 로드 성공");
    log("최상위 키: " + Object.keys(app).sort().join(", "));

    const project = await app.Project.getActiveProject();
    log(project ? "✓ 활성 프로젝트 있음" : "✗ 활성 프로젝트 없음");
    if (project) {
      const pm = Object.getOwnPropertyNames(Object.getPrototypeOf(project))
        .filter((k) => k !== "constructor")
        .sort();
      log("Project 메서드: " + pm.join(", "));

      const seq = await project.getActiveSequence();
      log(seq ? "✓ 활성 시퀀스 있음" : "✗ 활성 시퀀스 없음");
      if (seq) {
        const sm = Object.getOwnPropertyNames(Object.getPrototypeOf(seq))
          .filter((k) => k !== "constructor")
          .sort();
        log("Sequence 메서드: " + sm.join(", "));
      }
    }
  } catch (e) {
    log("✗ 오류: " + (e && e.message ? e.message : String(e)));
  }
  return out.join("\n");
}

/** 패널 버전 정보 (uxp host 정보 포함) */
function hostInfo() {
  try {
    const uxp = require("uxp");
    const h = uxp.host;
    return `${h.name} ${h.version} (UXP ${h.uxpVersion || "?"})`;
  } catch (e) {
    return "호스트 정보 없음";
  }
}

module.exports = {
  ppro,
  getProject,
  getSequence,
  getRootItem,
  runTransaction,
  describeApi,
  hostInfo,
};
