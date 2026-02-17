# navi

TypeScript TUI agent harness. Named after the computers in [Serial Experiments Lain](https://en.wikipedia.org/wiki/Serial_Experiments_Lain).

A learning project — building an AI agent loop from scratch to understand the internals: message management, tool execution, context windows, and terminal UI.

## Stack

- **Runtime:** [Bun](https://bun.sh)
- **Language:** TypeScript (strict)
- **Linting:** [oxlint](https://oxc.rs)
- **Formatting:** [oxfmt](https://oxc.rs)
- **Version pinning:** [proto](https://moonrepo.dev/proto)
- **Hooks:** [husky](https://typicode.github.io/husky/) (pre-commit: lint + fmt + test + tsc)

## Getting Started

```bash
# install dependencies
bun install

# copy env and add your API key(s)
cp .env.example .env

# run (interactive REPL)
bun start

# single-shot
bun start "explain monads"
echo "explain monads" | bun start

# with system prompt (string or file path)
bun start --system "You are a pirate."

# disable tools
bun start --no-tools

# dev mode (watch)
bun dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun start` | Run navi |
| `bun dev` | Run with file watching |
| `bun test` | Run tests |
| `bun run lint` | Lint with oxlint |
| `bun run fmt` | Format with oxfmt |
| `bun run check` | Lint + format check + test |

## Architecture

```
src/
  main.ts          # entrypoint, arg parsing, REPL runner
  api.ts           # Anthropic Messages API client (raw fetch, SSE streaming)
  config.ts        # env-based configuration
  repl.ts          # conversation state, agent loop, tool execution
  tools.ts         # tool registry + built-in tools
```

### Built-in Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Write content to a file (confirmation required) |
| `list_dir` | List directory contents |
| `exec` | Execute shell commands (confirmation required) |

### Development Workflow (CLAUDE.md)

1. **IMPLEMENT** — make changes in `src/`
2. **VERIFY** — `bun run check` + `npx tsc --noEmit`
3. **REVIEW** — spawn subagent with `skills/REVIEW.md` to review diff, fix issues, report

## Roadmap

Each milestone builds on the last. Designed for learning — every phase teaches a distinct concept and leaves you with something that runs.

### v0.1 — Single-shot LLM call ✅
**Learn:** API shape, message format, streaming, env config

- [x] Load config from env (API key, model name, base URL)
- [x] Send a single user prompt to Anthropic Messages API (raw `fetch`, no SDK)
- [x] Stream the response token-by-token to stdout
- [x] Handle errors gracefully (bad key, rate limit, network)
- [x] Print token usage after response completes
- [x] Tests: mock fetch, verify message construction and stream parsing

### v0.2 — Conversation loop ✅
**Learn:** Message array management, turn-taking, input handling

- [x] Interactive REPL: read user input, send, print response, repeat
- [x] Maintain conversation history (system + user/assistant message array)
- [x] System prompt loaded from file or flag (`--system`)
- [x] `/quit`, `/clear`, `/usage` commands
- [x] Token counting per turn and running total
- [x] Tests: conversation state management, command parsing

### v0.3 — Tool system ✅
**Learn:** Tool schemas, function calling protocol, execution sandbox

- [x] Tool registry: define tools as `{ name, description, schema, execute }` objects
- [x] Wire tools into API request (Anthropic tool_use format)
- [x] Parse tool_use blocks from responses, execute, return tool_result
- [x] Agent loop: repeat until model stops calling tools
- [x] Built-in tools: `read_file`, `write_file`, `list_dir`, `exec`
- [x] Tool call display in output (name, input, result)
- [x] Safety: confirmation prompt before exec/write
- [x] Tests: tool registry, execution, mock tool calls

### v0.4 — Context window management
**Learn:** Token budgets, truncation strategies, summarization

- [ ] Track total token usage against model's context window
- [ ] Truncation strategy: drop oldest messages when approaching limit
- [ ] Summarization strategy: condense old messages via LLM call
- [ ] Configurable strategy (truncate vs summarize vs fail)
- [ ] Reserve budget for system prompt + tools (they always fit)
- [ ] Tests: budget tracking, truncation logic, summary generation

### v0.5 — TUI
**Learn:** Terminal rendering, layout, real-time updates

- [ ] Structured terminal UI (not just raw stdout)
- [ ] Panels: conversation view, input area, status bar
- [ ] Streaming tokens render in-place (no scroll spam)
- [ ] Tool calls display inline with spinners/status
- [ ] Status bar: model, token usage, cost estimate, turn count
- [ ] Markdown rendering in terminal (bold, code blocks, lists)
- [ ] Color theme
- [ ] Tests: rendering logic (unit test the formatters, not the terminal)

### v0.6 — Multi-provider
**Learn:** API abstraction, adapter pattern, different message formats

- [ ] Provider interface: `send(messages, tools, config) → AsyncIterable<StreamEvent>`
- [ ] Anthropic provider (already built, refactor to interface)
- [ ] OpenAI provider (chat completions API, different tool format)
- [ ] Provider selection via config/flag (`--provider openai`)
- [ ] Normalize streaming events across providers
- [ ] Tests: provider adapters with recorded API responses

### v0.7 — Session persistence
**Learn:** Serialization, storage, resume logic

- [ ] Save conversation state to disk (JSON or SQLite)
- [ ] Resume a previous session by ID
- [ ] List past sessions with metadata (model, turns, created, last active)
- [ ] Auto-save after each turn
- [ ] `/save`, `/load`, `/sessions` commands
- [ ] Tests: serialization roundtrip, session listing

### Future ideas (unplanned)
- MCP (Model Context Protocol) tool server support
- Agent-to-agent delegation (spawn sub-agents)
- Cost tracking and budgets
- Plugin system for custom tools
- Config file (TOML) instead of just env/flags
- Prompt library / template system
- Evaluation harness (run prompts, score outputs)

## References

Essential reading for understanding agent harness design:

- **[The Harness Problem](https://blog.can.ac/2026/02/12/the-harness-problem/)** — Can Bölük's deep dive on how edit tool design matters more than model choice. Improved 15 LLMs by only changing the harness. Introduces hashline edits.
- **[Anthropic Messages API](https://docs.anthropic.com/en/api/messages)** — The raw API navi is built against. Streaming, tool use, message format.
- **[Anthropic Tool Use Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)** — How tool_use and tool_result blocks work in the message protocol.
- **[Pi Coding Agent](https://github.com/badlogic/pi-mono)** — Open-source coding agent by Mario Zechner. Clean reference implementation.
- **[oh-my-pi](https://github.com/can1357/oh-my-pi)** — Can Bölük's fork of Pi with 1,300+ commits of harness experimentation.
- **[Aider Benchmarks](https://aider.chat/docs/benchmarks.html)** — Shows how edit format choice swings model performance by 2x+.
- **[Diff-XYZ (JetBrains)](https://arxiv.org/abs/2510.12487)** — Systematic study confirming no single edit format dominates across models.
- **[EDIT-Bench](https://arxiv.org/abs/2511.04486)** — Benchmark for realistic code editing tasks across models.
- **[Cursor Instant Apply](https://cursor.com/blog/instant-apply)** — How Cursor trained a separate 70B model just to apply edits correctly.

## License

MIT
