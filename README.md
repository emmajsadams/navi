# navi

TypeScript TUI agent harness. Named after the computers in [Serial Experiments Lain](https://en.wikipedia.org/wiki/Serial_Experiments_Lain).

A learning project — building an AI agent loop from scratch to understand the internals: message management, tool execution, context windows, and terminal UI.

## Stack

- **Runtime:** [Bun](https://bun.sh)
- **Language:** TypeScript (strict)
- **Linting:** [oxlint](https://oxc.rs)
- **Formatting:** [oxfmt](https://oxc.rs)
- **Version pinning:** [proto](https://moonrepo.dev/proto)

## Getting Started

```bash
# install dependencies
bun install

# copy env and add your API key(s)
cp .env.example .env

# run
bun start

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

## Roadmap

Each milestone builds on the last. Designed for learning — every phase teaches a distinct concept and leaves you with something that runs.

### v0.1 — Single-shot LLM call
**Learn:** API shape, message format, streaming, env config

- [ ] Load config from env (API key, model name, base URL)
- [ ] Send a single user prompt to Anthropic Messages API (raw `fetch`, no SDK)
- [ ] Stream the response token-by-token to stdout
- [ ] Handle errors gracefully (bad key, rate limit, network)
- [ ] Print token usage after response completes
- [ ] Tests: mock fetch, verify message construction and stream parsing

**Result:** `echo "explain monads" | bun start` streams an answer.

### v0.2 — Conversation loop
**Learn:** Message array management, turn-taking, input handling

- [ ] Interactive REPL: read user input, send, print response, repeat
- [ ] Maintain conversation history (system + user/assistant message array)
- [ ] System prompt loaded from file or flag (`--system`)
- [ ] `/quit` and `/clear` commands
- [ ] Token counting per turn and running total
- [ ] Tests: conversation state management, command parsing

**Result:** A working chat REPL in the terminal. No tools yet, just conversation.

### v0.3 — Tool system
**Learn:** Tool schemas, function calling protocol, execution sandbox

- [ ] Tool registry: define tools as `{ name, description, schema, execute }` objects
- [ ] Wire tools into API request (Anthropic tool_use format)
- [ ] Parse tool_use blocks from responses, execute, return tool_result
- [ ] Agent loop: repeat until model stops calling tools
- [ ] Built-in tools: `read_file`, `write_file`, `list_dir`, `exec`
- [ ] Tool call display in output (name, input, result)
- [ ] Safety: confirmation prompt before exec/write, allowlist mode
- [ ] Tests: tool registry, execution loop, mock tool calls

**Result:** An agent that can read/write files and run commands when asked.

### v0.4 — Context window management
**Learn:** Token budgets, truncation strategies, summarization

- [ ] Track total token usage against model's context window
- [ ] Truncation strategy: drop oldest messages when approaching limit
- [ ] Summarization strategy: condense old messages via LLM call
- [ ] Configurable strategy (truncate vs summarize vs fail)
- [ ] Reserve budget for system prompt + tools (they always fit)
- [ ] Tests: budget tracking, truncation logic, summary generation

**Result:** Long conversations that don't crash when they hit the context limit.

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

**Result:** Looks like a real CLI agent, not a print-loop.

### v0.6 — Multi-provider
**Learn:** API abstraction, adapter pattern, different message formats

- [ ] Provider interface: `send(messages, tools, config) → AsyncIterable<StreamEvent>`
- [ ] Anthropic provider (already built, refactor to interface)
- [ ] OpenAI provider (chat completions API, different tool format)
- [ ] Provider selection via config/flag (`--provider openai`)
- [ ] Normalize streaming events across providers
- [ ] Tests: provider adapters with recorded API responses

**Result:** Same harness, multiple models. Switch with a flag.

### v0.7 — Session persistence
**Learn:** Serialization, storage, resume logic

- [ ] Save conversation state to disk (JSON or SQLite)
- [ ] Resume a previous session by ID
- [ ] List past sessions with metadata (model, turns, created, last active)
- [ ] Auto-save after each turn
- [ ] `/save`, `/load`, `/sessions` commands
- [ ] Tests: serialization roundtrip, session listing

**Result:** Close navi, come back later, pick up where you left off.

### Future ideas (unplanned)
- MCP (Model Context Protocol) tool server support
- Agent-to-agent delegation (spawn sub-agents)
- Cost tracking and budgets
- Plugin system for custom tools
- Config file (TOML) instead of just env/flags
- Prompt library / template system
- Evaluation harness (run prompts, score outputs)

## Architecture

```
src/
  main.ts          # entrypoint
```

_Architecture section will grow with each milestone._

## License

MIT
