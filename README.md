# Mini Coding Agent

A minimal Claude-like coding assistant in a single file. This agent demonstrates the core agentic loop: user input → LLM decides tool calls → local code executes them → results feed back to LLM → repeat.

## Features

- **File operations**: Read, write, edit, delete files and directories
- **GitHub integration**: Full GitHub CLI support for repositories, PRs, issues
- **Shell commands**: Execute git operations, npm/yarn commands, and other system commands
- **Interactive chat**: Conversational interface for coding assistance

## Setup

1. Clone the repository:
```bash
git clone https://github.com/michaelmov/mini-coding-agent.git
cd mini-coding-agent
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

4. Ensure GitHub CLI is installed and authenticated:
```bash
gh auth login
```

## Usage

Run the agent:
```bash
npm start
```

Or with TypeScript directly:
```bash
npx tsx agent.ts
```

## Available Tools

- `read_file` - Read file contents
- `list_files` - List directory contents
- `edit_file` - Edit or create files
- `delete_file` - Delete files
- `run_gh_command` - Execute GitHub CLI commands
- `run_shell_command` - Execute arbitrary shell commands

## Example Interactions

- "Create a new React component"
- "Initialize a git repository and push to GitHub"
- "Review the code in src/ and suggest improvements"
- "Create a pull request for the current changes"

## Inspiration

Inspired by [The Emperor Has No Clothes](https://www.mihaileric.com/The-Emperor-Has-No-Clothes/) by Mihail Eric.