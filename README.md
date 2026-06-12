# peekterm

A macOS menu-bar (tray) side-panel terminal. Click the menu-bar icon — or press a global hotkey — and a terminal slides in on the right half of your screen. Click away and it hides while your shell keeps running in the background. No Dock icon.

**English** | [한국어](README.ko.md)

## Features

- **Menu-bar driven** — runs from the tray and never appears in the Dock.
- **Side panel** — opens on the right of the active display (50% width, full height).
- **Click-away to hide** — losing focus hides the window; your work is untouched.
- **Background session** — a single `zsh` PTY stays alive, so you resume right where you left off.
- **Global hotkey** — summon the terminal from any app (default: **Command + backtick**, ⌘`).
- **Settings** — capture a hotkey, adjust font size, and switch between dark / light themes.

## Tech Stack

| Role | Library |
|------|---------|
| Framework | Electron |
| Build | electron-vite + TypeScript |
| UI | React |
| Terminal | @xterm/xterm + @xterm/addon-fit |
| PTY | node-pty |
| Font | JetBrains Mono (bundled) |
| Tests | Vitest |

## Requirements

- macOS
- Node.js 18+ (developed on Node 22)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Rebuild the native module (node-pty) against Electron's ABI
npm run rebuild

# 3. Run in development
npm run dev
```

> The `rebuild` step is required after install: `node-pty` is a native module that must match Electron's Node ABI.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the app in development (electron-vite) |
| `npm run build` | Build main / preload / renderer |
| `npm run package` | Build and package a macOS `.dmg` (electron-builder) |
| `npm run rebuild` | Rebuild `node-pty` for Electron |
| `npm test` | Run unit tests (Vitest) |
| `npm run typecheck` | Type-check with `tsc` |

## Usage

- **Open** — click the menu-bar icon or press the global hotkey (default **⌘`**).
- **Hide** — click outside the panel; the shell keeps running in the background.
- **Settings** — right-click the menu-bar icon → *Settings*.
  - **Global hotkey** — click *Change* and press your key combo.
  - **Font size** — slider (the font family is fixed to JetBrains Mono).
  - **Theme** — Dark / Light.

Settings are stored at `~/Library/Application Support/peekterm/settings.json`.

## Project Structure

```
src/
├── main/        # Electron main process (window, tray, PTY, hotkey, settings, IPC)
├── preload/     # contextBridge API
├── shared/      # types, IPC channels, pure logic (unit-tested)
└── renderer/    # React UI (terminal + settings)
```

## Notes

- Packaged builds are **unsigned**. On another Mac, right-click → *Open* (or run `xattr -cr /Applications/peekterm.app`). For public distribution, configure Apple Developer ID signing + notarization.

## License

MIT
