/**
 * Tool implementations and definitions for the Mini Coding Agent
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

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

export const tools: Anthropic.Messages.Tool[] = [
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

export function executeTool(
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