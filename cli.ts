#!/usr/bin/env node
/**
 * CLI entry point for the Mini Coding Agent.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { runAgentLoop } from "./agent";
import {
  getConfigPath,
  readConfig,
  writeConfig,
  resolveApiKey,
  resolveApiKeyWithSource,
  resolveModel,
  validateApiKey,
} from "./config";

interface ParsedArgs {
  subcommand: string[];
  apiKey?: string;
  model?: string;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { subcommand: [], help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--version" || a === "-v") out.version = true;
    else if (a === "--api-key") out.apiKey = argv[++i];
    else if (a === "--model") out.model = argv[++i];
    else if (a.startsWith("--api-key=")) out.apiKey = a.slice("--api-key=".length);
    else if (a.startsWith("--model=")) out.model = a.slice("--model=".length);
    else out.subcommand.push(a);
  }
  return out;
}

function readPackageJson(): { version: string; name: string } {
  // In compiled form this file lives at dist/cli.js; package.json sits one level up.
  // During `tsx` dev it lives at repo root next to package.json.
  const candidates = [
    path.join(__dirname, "..", "package.json"),
    path.join(__dirname, "package.json"),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      continue;
    }
  }
  return { version: "0.0.0", name: "mini-coding-agent" };
}

function printHelp(): void {
  const { name } = readPackageJson();
  console.log(`${name} — a minimal Claude-powered coding agent

Usage:
  mini-agent                       Start an interactive session
  mini-agent config set-key        Prompt for and save your Anthropic API key
  mini-agent config get            Show which layer the API key is loaded from
  mini-agent config path           Print the config file path
  mini-agent --help                Show this help
  mini-agent --version             Show the version

Options:
  --api-key <key>                  Use a specific Anthropic API key (not persisted)
  --model <id>                     Use a specific Claude model

Key resolution (highest precedence first):
  1. --api-key flag
  2. ANTHROPIC_API_KEY env var
  3. Config file (${getConfigPath()})
  4. Interactive prompt

Model resolution:
  1. --model flag
  2. MINI_AGENT_MODEL env var
  3. Config file "model" field
  4. Built-in default
`);
}

async function runConfigSubcommand(rest: string[]): Promise<number> {
  const cmd = rest[0];
  if (cmd === "set-key") {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      while (true) {
        const key = (await rl.question("Paste your Anthropic API key (sk-ant-...): ")).trim();
        if (!validateApiKey(key)) {
          console.log("That doesn't look like a valid key. Try again.\n");
          continue;
        }
        writeConfig({ apiKey: key });
        console.log(`Saved to ${getConfigPath()}`);
        return 0;
      }
    } finally {
      rl.close();
    }
  }
  if (cmd === "get") {
    const { source } = await resolveApiKeyWithSourceNoPrompt();
    console.log(`API key source: ${source ?? "none"}`);
    console.log(`Model: ${resolveModel()}`);
    return 0;
  }
  if (cmd === "path") {
    console.log(getConfigPath());
    return 0;
  }
  console.error(`Unknown config subcommand: ${cmd ?? "(none)"}`);
  console.error(`Available: set-key, get, path`);
  return 1;
}

async function resolveApiKeyWithSourceNoPrompt(): Promise<{ source: string | null }> {
  if (process.env.ANTHROPIC_API_KEY) return { source: "env" };
  const cfg = readConfig();
  if (cfg.apiKey) return { source: "config" };
  return { source: null };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.version) {
    console.log(readPackageJson().version);
    return 0;
  }
  if (args.subcommand[0] === "config") {
    return runConfigSubcommand(args.subcommand.slice(1));
  }
  if (args.subcommand.length > 0) {
    console.error(`Unknown command: ${args.subcommand[0]}`);
    console.error(`Run 'mini-agent --help' for usage.`);
    return 1;
  }

  const apiKey = await resolveApiKey(args.apiKey);
  const model = resolveModel(args.model);
  await runAgentLoop({ apiKey, model });
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`\x1b[91mFatal error:\x1b[0m`, err?.message ?? err);
    process.exit(1);
  }
);
