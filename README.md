# FFP 영상 워크플로우 (Premiere Pro UXP 플러그인)

프리미어 프로(Premiere Pro)와 연동해 반복 작업을 줄여주는 **UXP 패널**입니다.

- 🎬 **컷 편집 자동화** — 타임코드 목록이나 SRT를 붙여넣으면 시퀀스에 컷 지점 마커를 일괄로 찍습니다.
- 💬 **자막/캡션 생성** — 대본 텍스트를 읽기 속도에 맞춰 자동 타이밍한 SRT로 만들고, 시퀀스에 캡션 트랙으로 추가합니다.
- 📦 **에셋/파일 일괄 관리** — 여러 파일·폴더를 한 번에 임포트하고 빈(bin)으로 정리(폴더명/종류별)합니다.

> 빌드 단계 없이 **순수 JavaScript**로 작성되어, UXP Developer Tool에 바로 로드하고 수정 즉시 반영됩니다.

---

## 1. 요구 사항

- **Adobe Premiere Pro 25.0 이상** (UXP 플러그인을 지원하는 버전)
- **UXP Developer Tool (UDT)** — [Adobe Creative Cloud Desktop](https://creativecloud.adobe.com/apps/download/uxp-developer-tools)에서 설치
- 개발용으로 테스트만 한다면 그 외 도구는 필요 없습니다. (단위 테스트 실행 시에만 Node.js)

## 2. 설치 & 실행 (개발 모드)

1. **Premiere Pro에서 개발자 모드 켜기**
   - `환경 설정(Preferences)` → 관련 옵션에서 UXP 개발자 모드를 활성화한 뒤 Premiere를 **재시작**합니다.
2. **UXP Developer Tool 실행 → 플러그인 추가**
   - `Add Plugin...` 버튼 → 이 저장소의 **`manifest.json`** 선택.
3. **로드**
   - 추가된 플러그인 행에서 `Load`(또는 `••• → Load & Watch`)를 누릅니다.
   - `Load & Watch`로 켜두면 소스 파일을 고칠 때마다 자동 반영됩니다.
4. **패널 열기**
   - Premiere Pro 상단 메뉴 `창(Window) → UXP 플러그인 → FFP 워크플로우`.

> 참고: UDT의 **Watch는 소스 파일만** 다시 불러옵니다. `manifest.json`을 바꾸면 `Unload` 후 다시 `Load` 하세요.

## 3. 사용법

### 🎬 컷 편집 탭

컷할 지점을 미리 정해두면 마커로 찍어 타임라인 편집을 일관되게 만들어 줍니다.

- **타임코드 → 마커**: 텍스트 영역에 한 줄에 하나씩 입력
  ```
  00:00:03,000 인트로 끝
  00:00:11,200 본문 시작
  00:01:24,000 마무리
  ```
- **SRT 붙여넣어 마커**: 같은 칸에 SRT 전체를 붙여넣으면 각 자막 시작점마다 마커 생성.
- **현재 시퀀스 마커 보기**: 지금 시퀀스에 찍힌 마커를 타임코드로 나열.

### 💬 자막 탭

1. 대본을 **한 줄 = 한 자막**으로 붙여넣습니다.
2. `읽기속도(글자/초)`로 자막 길이를 조절합니다(한국어는 12~16 권장).
3. 버튼 선택:
   - **미리보기**: 만들어질 SRT를 화면에서 확인.
   - **SRT 저장**: `.srt` 파일로 저장.
   - **SRT 저장 → 시퀀스에 캡션 추가**: 저장과 동시에 활성 시퀀스에 캡션 트랙 생성.
   - **기존 SRT 파일 → 캡션 트랙**: 이미 있는 SRT를 임포트해 캡션 트랙으로 추가.

> UXP의 캡션 '내용' 직접 편집 API는 아직 제한적이라, 표준 SRT 파일을 만들어 임포트하는 방식을 씁니다. 가장 호환성이 좋고 다른 편집 환경에서도 재사용할 수 있습니다.

### 📦 에셋 탭

- **파일 여러 개 임포트**: 파일 선택 창에서 여러 개를 골라 한 번에 임포트(원하면 새 빈에).
- **폴더 → 폴더명 빈으로 임포트**: 폴더를 고르면 그 안의 미디어를 폴더 이름의 빈에 정리.
- **폴더 → 종류별 빈으로 분류 임포트**: 영상/오디오/이미지/자막 빈으로 자동 분류.

### 🛠 환경 점검

하단의 **환경 점검** 버튼은 현재 설치된 Premiere/UXP 버전에서 실제로 사용 가능한 API(메서드 목록)를 로그에 출력합니다. 버전에 따라 동작이 다를 때 원인 파악에 사용하세요.

## 4. 프로젝트 구조

```
manifest.json        UXP 플러그인 매니페스트 (manifestVersion 5, host premierepro 25.2+)
index.html           패널 UI
src/
  main.js            UI ↔ 기능 연결, 로그/에러 처리
  styles.css         패널 스타일
  lib/
    ppro.js          premierepro API 래퍼 + 진단(describeApi)
    cut.js           컷 편집(마커) 자동화
    captions.js      자막/캡션 생성 (SRT ↔ 캡션 트랙)
    assets.js        에셋/폴더 일괄 임포트·정리
    srt.js           SRT 파싱/생성 (순수 함수, 테스트 대상)
test/
  srt.test.js        srt.js 단위 테스트
icons/               패널/목록 아이콘
```

## 5. 테스트

Premiere 없이도 자막 핵심 로직(SRT 파싱/생성/타이밍)을 검증할 수 있습니다.

```bash
npm test
```

## 6. 설계 노트 — 버전 호환성

UXP for Premiere Pro API는 릴리스마다 메서드가 추가/변경됩니다. 이 플러그인은:

- **방어적 호출**: 마커·빈 생성 등은 알려진 여러 시그니처를 순서대로 시도하고, 실패 시 **명확한 한국어 메시지**를 로그에 남깁니다.
- **진단 우선**: `ppro.js`의 `describeApi()`로 설치된 버전의 실제 API를 점검할 수 있어, 메서드 이름이 다른 경우 빠르게 맞출 수 있습니다.
- **프레임 스냅(26+)**: Premiere Pro 26부터 UXP에서 시퀀스 프레임레이트를 읽을 수 있어, 마커 시간을 프레임 경계로 맞춰 컷이 정확해집니다. 25 이하에서는 자동으로 스냅을 생략합니다.

> 참고: Premiere 26 본체에는 캡션 자동 번역(27개 언어 이상), 다중 캡션 트랙, 단어 단위 캡션 같은 기능이 내장되어 있습니다. 이 플러그인이 만든 SRT/캡션 트랙과 함께 활용하면 좋습니다.

특정 버전에서 동작하지 않는 기능이 있으면 **환경 점검** 출력 결과를 알려주시면 해당 버전에 맞춰 조정할 수 있습니다.

## 7. 다음 단계 (선택)

- **TypeScript 전환**: 자동완성과 타입 안정성을 원하면 `@adobe/premierepro` 타입 패키지를 추가하고 esbuild로 번들링하는 구성으로 확장할 수 있습니다.
- **무음 구간 자동 컷**: 오디오 파형 분석은 UXP 단독으로 어려워, 외부(STT/무음 검출) 결과를 타임코드/SRT로 받아 컷 편집 탭에 넣는 방식으로 연동할 수 있습니다.
- **배포(.ccx)**: 정식 배포 시 UDT의 `Package` 기능으로 `.ccx`를 만들어 설치 배포할 수 있습니다.

## 참고 문서

- Premiere UXP 개발자 문서: https://developer.adobe.com/premiere-pro/uxp/
- API 레퍼런스: https://developer.adobe.com/premiere-pro/uxp/ppro-reference/
- 공식 샘플: https://github.com/AdobeDocs/uxp-premiere-pro-samples
- 매니페스트 가이드: https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/
