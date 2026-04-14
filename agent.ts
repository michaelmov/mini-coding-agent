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
import * as readline from "node:readline";
import { tools, executeTool } from "./tools";

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
