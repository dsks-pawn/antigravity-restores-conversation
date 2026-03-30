# Antigravity Restores Conversation ✨

Ever closed your Antigravity IDE and noticed that all your AI conversations have been wiped out from the sidebar or reverted to "New Conversation" placeholders?

**Antigravity Restores Conversation** is a powerful standalone rescue utility designed specifically for developers using the Antigravity IDE. It scans your local workspace for orphaned conversation history files (`*.pb`) and intelligently rebuilds the internal SQLite Database index (`state.vscdb`) so that your conversation history is perfectly restored and mapped back to the correct workspaces!

## 🚀 Features

- **Blazing Fast Scanning:** Quickly sweeps your AppData directory for Antigravity `.pb` conversation logs using high-performance Protobuf parsing.
- **Smart Workspace Mapping:** Automatically matches orphaned conversations back to the correct VS Code/Antigravity Workspaces based on directory paths.
- **Zero Dependencies:** Pure plug & play functionality out of the box. No need to install Node.js or any VS Code Extensions.
- **Gorgeous Terminal UI (TUI):** A minimalist, developer-friendly and fully interactive terminal interface using `@clack/prompts`.
- **Cross-Platform:** Pre-compiled native binaries are provided for Windows (`.exe`), macOS, and Linux out of the box!

## 🛠️ Usage (For End Users)

You **do not** need to install anything. Just download and run!

1. Go to the [Releases](https://github.com/your-username/antigravity-restores-conversation/releases) page of this repository.
2. Download the executable exactly for your operating system:
   - **Windows:** `antigravity-restores-conversation-win.exe`
   - **macOS:** `antigravity-restores-conversation-macos`
   - **Linux:** `antigravity-restores-conversation-linux`
3. Open a terminal or Command Prompt, and run the downloaded file directly:
   - _Windows:_ `.\antigravity-restores-conversation-win.exe` (Or just double-click it!)
   - _macOS/Linux:_ `chmod +x antigravity-restores-conversation-macos && ./antigravity-restores-conversation-macos`
4. Answer the beautiful terminal prompts and watch your lost conversations magically return to the Antigravity sidebar!

⚠️ **Important:** Ensure you **completely close** the Antigravity IDE before running the repair, so the tool can safely rebuild the internal database without encountering file locks.

## 📦 For Developers (How to Build from Source)

If you want to modify the source code or build the binaries yourself:

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Build the cross-platform executable binaries (requires Node.js 20+ for Single Executable Application support):

   ```bash
   npm run build:exe
   ```

   _The outputs will be placed in the `bin/` directory._

3. Release automation:
   - This project uses GitHub Actions to build and release binaries automatically.
   - To create a release, just push a new tag (e.g., `v1.0.1`) and the binaries for Windows, macOS, and Linux will be automatically attached to the release.

4. Run the development CLI locally:
   ```bash
   npm run dev
   ```

---

_Made with ❤️ for the Antigravity Developer Community._
