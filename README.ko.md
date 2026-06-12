# peekterm

맥OS 메뉴바(트레이) 사이드패널 터미널입니다. 메뉴바 아이콘을 클릭하거나 전역 단축키를 누르면 화면 오른쪽 절반에 터미널이 나타납니다. 바깥을 클릭하면 숨겨지지만 셸은 백그라운드에서 계속 실행되며, Dock에는 아이콘이 표시되지 않습니다.

[English](README.md) | **한국어**

## 기능

- **메뉴바 전용** — 트레이에서 동작하며 Dock에는 나타나지 않습니다.
- **사이드패널** — 현재 디스플레이 오른쪽에 열립니다(너비 50%, 높이 100%).
- **바깥 클릭 시 숨김** — 포커스를 잃으면 숨겨지고, 작업 내용은 그대로 유지됩니다.
- **백그라운드 세션** — 단일 `zsh` PTY가 계속 살아 있어 하던 작업을 이어서 진행할 수 있습니다.
- **전역 단축키** — 어떤 앱에서든 터미널을 호출합니다(기본값: **Command + 백틱**, ⌘`).
- **설정** — 단축키 지정, 폰트 크기 조절, 다크/라이트 테마 전환.

## 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| 프레임워크 | Electron |
| 빌드 | electron-vite + TypeScript |
| UI | React |
| 터미널 | @xterm/xterm + @xterm/addon-fit |
| PTY | node-pty |
| 폰트 | JetBrains Mono (번들) |
| 테스트 | Vitest |

## 요구 사항

- macOS
- Node.js 18+ (Node 22에서 개발)

## 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. 네이티브 모듈(node-pty)을 Electron ABI에 맞춰 리빌드
npm run rebuild

# 3. 개발 모드 실행
npm run dev
```

> `rebuild` 단계는 설치 후 반드시 필요합니다. `node-pty`는 네이티브 모듈이라 Electron의 Node ABI와 일치시켜야 합니다.

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 모드 실행 (electron-vite) |
| `npm run build` | main / preload / renderer 빌드 |
| `npm run package` | macOS `.dmg` 빌드·패키징 (electron-builder) |
| `npm run rebuild` | Electron용 `node-pty` 리빌드 |
| `npm test` | 단위 테스트 실행 (Vitest) |
| `npm run typecheck` | `tsc` 타입 체크 |

## 사용법

- **열기** — 메뉴바 아이콘 클릭 또는 전역 단축키(기본 **⌘`**).
- **숨기기** — 패널 바깥을 클릭하면 숨겨지고, 셸은 백그라운드에서 계속 실행됩니다.
- **설정** — 메뉴바 아이콘 우클릭 → *설정*.
  - **전역 단축키** — *변경*을 누른 뒤 원하는 조합키를 입력.
  - **폰트 크기** — 슬라이더 (폰트 종류는 JetBrains Mono로 고정).
  - **테마** — 다크 / 라이트.

설정은 `~/Library/Application Support/peekterm/settings.json`에 저장됩니다.

## 프로젝트 구조

```
src/
├── main/        # Electron 메인 프로세스 (창, 트레이, PTY, 단축키, 설정, IPC)
├── preload/     # contextBridge API
├── shared/      # 타입, IPC 채널, 순수 로직 (단위 테스트 대상)
└── renderer/    # React UI (터미널 + 설정)
```

## 참고

- 패키징 결과물은 **서명되지 않은(unsigned)** 앱입니다. 다른 Mac에서는 우클릭 → *열기*(또는 `xattr -cr /Applications/peekterm.app` 실행)로 여세요. 외부 정식 배포에는 Apple Developer ID 서명 + 공증(notarization)이 필요합니다.

## 라이선스

MIT
