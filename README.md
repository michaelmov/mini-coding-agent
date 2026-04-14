# Mini Coding Agent

A minimal Claude-like coding assistant in a single file. This agent demonstrates the core agentic loop: user input → LLM decides tool calls → local code executes them → results feed back to LLM → repeat.

## Features

- **File operations**: Read, write, edit, delete files and directories
- **GitHub integration**: Full GitHub CLI support for repositories, PRs, issues
- **Shell commands**: Execute git operations, npm/yarn commands, and other system commands
- **Interactive chat**: Conversational interface with user approval for each tool execution
- **Safety first**: All tool calls require user approval before execution

## Architecture

The entire agent is contained in a single TypeScript file (`agent.ts`) that implements:
- Tool definitions and implementations
- Anthropic Claude API integration
- Interactive terminal interface
- Complete agentic reasoning loop

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

The agent will start an interactive session where you can chat with Claude and approve tool executions. Type "exit" to quit.

## Available Tools

- **`read_file`** - Read the full contents of a file
- **`list_files`** - List all files and directories at a given path
- **`edit_file`** - Edit files by string replacement or create new files
- **`delete_file`** - Delete files at a given path
- **`run_gh_command`** - Execute GitHub CLI commands (PRs, issues, repo operations)
- **`bash`** - Execute arbitrary bash commands (git, npm, system operations)

## Example Interactions

- "Create a new React component in src/components/"
- "Initialize a git repository and push to GitHub"
- "Review the code in this project and suggest improvements"
- "Create a pull request for the current changes"
- "Run the tests and fix any failing ones"
- "Add TypeScript types to this JavaScript file"

## Technical Details

- **Model**: Claude Sonnet 4 (latest)
- **Language**: TypeScript
- **Dependencies**: Minimal - just Anthropic SDK and dotenv
- **Safety**: All tool executions require user approval
- **File Operations**: Supports absolute and relative paths
- **Error Handling**: Tools return structured error responses for LLM recovery

## Inspiration

Inspired by [The Emperor Has No Clothes](https://www.mihaileric.com/The-Emperor-Has-No-Clothes/) by Mihail Eric - demonstrating that effective AI agents don't require complex frameworks, just clear tool definitions and a solid reasoning loop.