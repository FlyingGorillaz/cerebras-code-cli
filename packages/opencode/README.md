<p align="center">
  <img src="https://cerebras.ai/wp-content/uploads/2024/01/cerebras-logo.svg" alt="Cerebras" width="300">
</p>

<h1 align="center">Cerebras Code CLI</h1>

<p align="center">
  <strong>The blazing-fast AI coding agent for the terminal — powered by Cerebras inference.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cerebras/code-cli"><img src="https://img.shields.io/npm/v/@cerebras/code-cli.svg" alt="npm version"></a>
  <a href="https://github.com/kevint-cerebras/cerebras-code-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <em>Get instant AI-powered coding assistance with responses in milliseconds, not seconds.</em>
</p>

---

## ⚡ Why Cerebras Code CLI?

- **Instant responses** — Cerebras inference delivers responses in milliseconds
- **Terminal-native** — Beautiful TUI with vim-style keybindings
- **Full coding agent** — File editing, bash commands, code analysis, and more
- **Context-aware** — Understands your entire codebase
- **MCP support** — Extensible via Model Context Protocol

---

## 🚀 Quick Start

### Install globally

```bash
npm install -g @cerebras/code-cli
```

### Or run directly with npx

```bash
npx @cerebras/code-cli
```

### Get your API key

1. Visit [cloud.cerebras.ai](https://cloud.cerebras.ai)
2. Create an account and generate an API key
3. The CLI will prompt you to enter it on first run

---

## 📖 Usage

### Start the CLI

```bash
cerebras-code
```

### Start with a prompt

```bash
cerebras-code "explain this codebase"
```

### Resume a previous session

```bash
cerebras-code --resume
```

### Continue the last session

```bash
cerebras-code --continue
```

---

## ⌨️ Keyboard Shortcuts

The leader key is `Ctrl+X` by default. Press it first, then the following key:

| Shortcut | Action |
|----------|--------|
| `Ctrl+X` `n` | New session |
| `Ctrl+X` `l` | List sessions |
| `Ctrl+X` `b` | Toggle sidebar |
| `Ctrl+X` `s` | View status |
| `Ctrl+X` `t` | Change theme |
| `Ctrl+X` `c` | Compact session |
| `Ctrl+X` `e` | Open in external editor |
| `Ctrl+X` `g` | Session timeline |
| `Tab` | Cycle agent modes |
| `Escape` | Interrupt/Cancel |
| `Ctrl+C` | Exit |
| `PageUp/Down` | Scroll messages |

Press `Ctrl+X` `?` or type `/help` for all commands.

---

## 🤖 Agent Modes

Switch modes with `Tab`:

| Mode | Description |
|------|-------------|
| **code** | Full access — edit files, run commands, build projects |
| **ask** | Read-only — analyze code, answer questions, explain concepts |

---

## 💬 Slash Commands

Type these in the prompt:

| Command | Description |
|---------|-------------|
| `/model` | Switch AI model |
| `/provider` | Switch AI provider |
| `/theme` | Change color theme |
| `/undo` | Undo last message |
| `/redo` | Redo last message |
| `/compact` | Summarize and compact session |
| `/copy` | Copy session transcript |
| `/export` | Export session to file |
| `/clear` | Clear prompt |
| `/help` | Show help |

---

## 🎨 Themes

28 built-in themes including:

- `opencode` (default - Cerebras orange)
- `catppuccin`, `catppuccin-macchiato`
- `dracula`, `nord`, `gruvbox`
- `tokyonight`, `one-dark`, `monokai`
- `github`, `aura`, `synthwave84`
- `matrix`, `rosepine`, `kanagawa`
- And many more...

Change theme with `Ctrl+X` `t` or `/theme`.

---

## ⚙️ Configuration

Create `~/.config/opencode/config.json`:

```json
{
  "model": "cerebras/zai-glm-4.7",
  "theme": "opencode",
  "keybinds": {
    "leader": "ctrl+x",
    "app_exit": "ctrl+c,ctrl+d"
  }
}
```

### Project-specific config

Create `.opencode/config.json` in your project root for project-specific settings.

### Environment Variables

```bash
# Set your Cerebras API key
export CEREBRAS_API_KEY=csk-...

# Or use a config file
echo '{"providers":{"cerebras":{"apiKey":"csk-..."}}}' > ~/.config/opencode/config.json
```

---

## 🔌 MCP (Model Context Protocol)

Extend the CLI with MCP servers:

```json
{
  "mcp": {
    "servers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
      }
    }
  }
}
```

---

## 📊 Features

### Real-time Cache Monitoring
See your cache hit rate with sparklines and visual indicators in the sidebar.

### Context Window Tracking
Monitor your token usage with a visual progress bar.

### Rate Limit Awareness
Get notified when approaching rate limits with upgrade suggestions.

### Multi-Provider Support
While optimized for Cerebras, also supports:
- OpenAI
- Anthropic
- Google (Gemini)
- And more via OpenRouter

---

## 🛠️ System Requirements

- **Node.js** 18+ or **Bun** 1.0+
- **Terminal** with 256-color support
- **macOS**, **Linux**, or **Windows** (WSL recommended)

---

## 📝 License

MIT © [Cerebras](https://cerebras.ai)

---

## 🙏 Acknowledgments

Fork of [OpenCode](https://github.com/sst/opencode) by SST, adapted for Cerebras's lightning-fast inference.

---

<p align="center">
  <strong>Built with ⚡ by Cerebras</strong>
</p>

<p align="center">
  <a href="https://cerebras.ai">Website</a> •
  <a href="https://cloud.cerebras.ai">Get API Key</a> •
  <a href="https://github.com/kevint-cerebras/cerebras-code-cli/issues">Report Bug</a>
</p>
