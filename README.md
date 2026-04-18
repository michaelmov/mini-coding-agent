# Mini Coding Agent

A minimal Claude-powered coding assistant that lives in your terminal. Demonstrates the core agentic loop: user input → LLM decides tool calls → local code executes them → results feed back to LLM → repeat.

## Install

```bash
npm install -g mini-coding-agent
```

Requires Node.js 20+. macOS and Linux supported.

You'll also want [GitHub CLI (`gh`)](https://cli.github.com/) authenticated if you want the agent to work with PRs and issues.

## Quickstart

```bash
mini-agent
```

On first run, the agent will prompt for your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com/settings/keys)) and offer to save it. After that, just run `mini-agent` anywhere.

Type `exit` to quit.

## API key

The agent resolves your key in this order (highest precedence first):

1. `--api-key <key>` CLI flag
2. `ANTHROPIC_API_KEY` environment variable
3. Config file at `~/.config/mini-coding-agent/config.json` (or `$XDG_CONFIG_HOME/mini-coding-agent/config.json`)
4. Interactive first-run prompt (with option to save to the config file)

To manage the saved key:

```bash
mini-agent config set-key   # prompt & save
mini-agent config get       # show which layer the key is loaded from (never prints the key)
mini-agent config path      # show the config file path
```

## Model override

The default model is `claude-sonnet-4-20250514`. Override with:

- `--model <id>` flag
- `MINI_AGENT_MODEL` env var
- `"model": "<id>"` field in the config file

## Available tools

Each tool call requires your explicit approval before it runs.

- `read_file` — read file contents
- `list_files` — list directory entries
- `edit_file` — edit by string replacement, or create a new file
- `delete_file` — delete a file
- `run_gh_command` — run `gh` CLI commands (PRs, issues, repo info)
- `bash` — run arbitrary bash commands

## Uninstall

```bash
npm uninstall -g mini-coding-agent
rm -rf ~/.config/mini-coding-agent   # optional: remove saved config
```

## Development

```bash
git clone https://github.com/michaelmov/mini-coding-agent.git
cd mini-coding-agent
npm install
npm run dev       # runs cli.ts via tsx
npm run build     # compiles to dist/
```

## Inspiration

Inspired by [The Emperor Has No Clothes](https://www.mihaileric.com/The-Emperor-Has-No-Clothes/) by Mihail Eric — effective AI agents don't require complex frameworks, just clear tool definitions and a solid reasoning loop.
