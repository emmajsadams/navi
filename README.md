# navi

TypeScript TUI agent harness. Named after the computers in [Serial Experiments Lain](https://en.wikipedia.org/wiki/Serial_Experiments_Lain).

A learning project — building an AI agent loop from scratch to understand the internals: message management, tool execution, context windows, and terminal UI.

## Stack

- **Runtime:** [Bun](https://bun.sh)
- **Language:** TypeScript (strict)
- **Linting:** [oxlint](https://oxc.rs)
- **Formatting:** [oxfmt](https://oxc.rs)

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

## Architecture

```
src/
  main.ts          # entrypoint
```

_More to come as the project grows._

## Roadmap

- [ ] Core agent loop (prompt → LLM → tool exec → repeat)
- [ ] Tool system (registry, schema, execution)
- [ ] Conversation/context window management
- [ ] TUI (streaming responses, tool call display, token usage)
- [ ] Multi-provider support (Anthropic, OpenAI)
- [ ] Session persistence

## License

MIT
