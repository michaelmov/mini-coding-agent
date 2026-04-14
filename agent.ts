/**
 * Mini Coding Agent
 *
 * A minimal Claude-like coding assistant in a single file.
 * Demonstrates the core agentic loop: user input -> LLM decides tool calls ->
 * local code executes them -> results feed back to LLM -> repeat.
 *
 * Inspired by: https://www.mihaileric.com/The-Emperor-Has-No-Clothes/
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { execSync } from "node:child_process";

config(); // Load .env

// ─── Anthropic Client ────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;

// ─── Terminal Colors ─────────────────────────────────────────────────────────

const BLUE = "\x1b[94m";
const YELLOW = "\x1b[93m";
const RED = "\x1b[91m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

// ─── Path Utility ────────────────────────────────────────────────────────────

function resolveAbsPath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

// ─── Tool Implementations ────────────────────────────────────────────────────
// Each tool returns a JSON-serializable result object.
// Errors are caught and returned as { error: string } so the LLM can recover.

function readFile(filePath: string): Record<string, unknown> {
  try {
    const abs = resolveAbsPath(filePath);
    const content = fs.readFileSync(abs, "utf-8");
    return { path: abs, content };
  } catch (err: any) {
    return { error: `Failed to read file: ${err.message}` };
  }
}

function listFiles(dirPath: string): Record<string, unknown> {
  try {
    const abs = resolveAbsPath(dirPath);
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    const files = entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "directory" : "file",
    }));
    return { path: abs, files };
  } catch (err: any) {
    return { error: `Failed to list files: ${err.message}` };
  }
}

function editFile(
  filePath: string,
  oldStr: string,
  newStr: string
): Record<string, unknown> {
  try {
    const abs = resolveAbsPath(filePath);

    // If old_str is empty, create or overwrite the file
    if (oldStr === "") {
      const dir = path.dirname(abs);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(abs, newStr, "utf-8");
      return { path: abs, action: "created" };
    }

    // Otherwise, replace first occurrence
    const original = fs.readFileSync(abs, "utf-8");
    if (!original.includes(oldStr)) {
      return { path: abs, error: "old_str not found in file" };
    }
    const edited = original.replace(oldStr, newStr);
    fs.writeFileSync(abs, edited, "utf-8");
    return { path: abs, action: "edited" };
  } catch (err: any) {
    return { error: `Failed to edit file: ${err.message}` };
  }
}

function deleteFile(filePath: string): Record<string, unknown> {
  try {
    const abs = resolveAbsPath(filePath);
    fs.unlinkSync(abs);
    return { path: abs, action: "deleted" };
  } catch (err: any) {
    return { error: `Failed to delete file: ${err.message}` };
  }
}

function runGhCommand(args: string): Record<string, unknown> {
  try {
    const output = execSync(`gh ${args}`, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    return { stdout: output.trim() };
  } catch (err: any) {
    return { error: err.stderr?.trim() || err.message };
  }
}

function runBashCommand(command: string): Record<string, unknown> {
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: "utf-8",
      shell: "/bin/bash",
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });
    return { stdout: output.trim() };
  } catch (err: any) {
    return {
      error: err.stderr?.trim() || err.message,
      exitCode: err.status,
    };
  }
}

// ─── Anthropic Tool Definitions ──────────────────────────────────────────────
// These tell the LLM what tools are available and their parameter schemas.

const tools: Anthropic.Messages.Tool[] = [
  {
    name: "read_file",
    description:
      "Read the full contents of a file. Use this to inspect existing code or text.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Path to the file to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_files",
    description:
      "List all files and directories at the given path. Use this to explore project structure.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the directory to list (default: current dir)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "edit_file",
    description:
      "Edit a file by replacing the first occurrence of old_str with new_str. " +
      "To create a new file, set old_str to an empty string and new_str to the file content.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Path to the file to edit" },
        old_str: {
          type: "string",
          description:
            "The string to find and replace. Empty string means create/overwrite.",
        },
        new_str: { type: "string", description: "The replacement string" },
      },
      required: ["path", "old_str", "new_str"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file at the given path.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Path to the file to delete" },
      },
      required: ["path"],
    },
  },
  {
    name: "run_gh_command",
    description:
      "Run a GitHub CLI (gh) command. Use this for PRs, issues, repo info, CI status, etc. " +
      "The 'gh' prefix is added automatically — just provide the arguments " +
      "(e.g., 'pr list' or 'issue create --title \"bug\" --body \"details\"').",
    input_schema: {
      type: "object" as const,
      properties: {
        args: {
          type: "string",
          description:
            "Arguments to pass to the gh CLI (without the 'gh' prefix)",
        },
      },
      required: ["args"],
    },
  },
  {
    name: "bash",
    description:
      "Run a bash command. Use this for git operations, npm/yarn commands, " +
      "running tests, installing dependencies, or any other system commands. " +
      "Be careful with destructive operations.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The bash command to execute",
        },
      },
      required: ["command"],
    },
  },
];

// ─── Tool Dispatcher ─────────────────────────────────────────────────────────

function executeTool(
  name: string,
  input: Record<string, any>
): Record<string, unknown> {
  switch (name) {
    case "read_file":
      return readFile(input.path);
    case "list_files":
      return listFiles(input.path);
    case "edit_file":
      return editFile(input.path, input.old_str, input.new_str);
    case "delete_file":
      return deleteFile(input.path);
    case "run_gh_command":
      return runGhCommand(input.args);
    case "bash":
      return runBashCommand(input.command);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a coding assistant that helps users with file operations and coding tasks.
You have access to tools for reading, listing, creating, editing, and deleting files.
You also have access to the GitHub CLI (gh) for interacting with GitHub repositories,
pull requests, issues, and more. The user's gh CLI is already authenticated.
You can also run bash commands for git operations, npm/yarn commands, running tests, and other system tasks.
Use these tools to explore the project and make changes as requested.
Always read a file before editing it so you understand the current contents.
When creating new files, use edit_file with an empty old_str.
Be concise in your responses.`;

// ─── The Agentic Loop ────────────────────────────────────────────────────────

async function runAgentLoop() {
  // Conversation history sent to the API on every turn
  const messages: Anthropic.Messages.MessageParam[] = [];

  // Set up terminal input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  console.log(`${DIM}Mini Coding Agent (type "exit" to quit)${RESET}\n`);

  // ── Outer loop: read user input ──────────────────────────────────────────
  while (true) {
    const userInput = await prompt(`${BLUE}You:${RESET} `);
    if (!userInput.trim() || userInput.trim().toLowerCase() === "exit") {
      console.log("Goodbye!");
      rl.close();
      break;
    }

    messages.push({ role: "user", content: userInput.trim() });

    // ── Inner loop: call LLM, execute tools, repeat until text-only ──────
    while (true) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      // Collect tool_use blocks from the response
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use"
      );

      // Print any text blocks the LLM returned
      for (const block of response.content) {
        if (block.type === "text" && block.text) {
          console.log(`\n${YELLOW}Agent:${RESET} ${block.text}`);
        }
      }

      // If the LLM didn't request any tools, this turn is done
      if (toolUseBlocks.length === 0) {
        messages.push({ role: "assistant", content: response.content });
        break;
      }

      // Append the assistant's full response (including tool_use blocks)
      messages.push({ role: "assistant", content: response.content });

      // Execute each tool (with user approval) and collect results
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        console.log(
          `\n${DIM}  [tool] ${toolUse.name}(${JSON.stringify(toolUse.input)})${RESET}`
        );

        // Ask for user approval before executing
        const approval = await prompt(
          `${BLUE}  Allow? (y/n):${RESET} `
        );

        if (approval.trim().toLowerCase() !== "y") {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: "User denied this tool call." }),
          });
          continue;
        }

        const result = executeTool(
          toolUse.name,
          toolUse.input as Record<string, any>
        );
        console.log(
          `${DIM}  [result] ${JSON.stringify(result).slice(0, 200)}${RESET}`
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Feed tool results back to the LLM
      messages.push({ role: "user", content: toolResults });
    }

    console.log(); // blank line between turns
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

runAgentLoop().catch((err) => {
  console.error(`${RED}Fatal error:${RESET}`, err.message);
  process.exit(1);
});
