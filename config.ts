/**
 * Config resolution for the Mini Coding Agent.
 *
 * Resolves the Anthropic API key and model via a layered lookup:
 *   1. Explicit flag (e.g. --api-key)
 *   2. ANTHROPIC_API_KEY env var
 *   3. Config file at $XDG_CONFIG_HOME/mini-coding-agent/config.json
 *   4. Interactive first-run prompt (with option to persist to config file)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline/promises";

export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export interface ConfigFile {
  apiKey?: string;
  model?: string;
}

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), ".config");
  return path.join(base, "mini-coding-agent");
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function readConfig(): ConfigFile {
  const p = getConfigPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function writeConfig(partial: ConfigFile): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const current = readConfig();
  const merged = { ...current, ...partial };
  const p = getConfigPath();
  fs.writeFileSync(p, JSON.stringify(merged, null, 2) + "\n", { mode: 0o600 });
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    // best-effort; not fatal on filesystems that don't support chmod
  }
}

export function validateApiKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9\-_]+$/.test(key.trim());
}

async function promptForKey(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    console.log("No Anthropic API key found.");
    console.log("Get one at: https://console.anthropic.com/settings/keys\n");
    while (true) {
      const answer = (await rl.question("Paste your API key (sk-ant-...): ")).trim();
      if (!validateApiKey(answer)) {
        console.log("That doesn't look like a valid key. Try again.\n");
        continue;
      }
      const save = (await rl.question(
        `Save to ${getConfigPath()} for future runs? (Y/n): `
      )).trim().toLowerCase();
      if (save === "" || save === "y" || save === "yes") {
        writeConfig({ apiKey: answer });
        console.log(`Saved. (You can change it later with: mini-agent config set-key)\n`);
      }
      return answer;
    }
  } finally {
    rl.close();
  }
}

export interface KeySource {
  key: string;
  source: "flag" | "env" | "config" | "prompt";
}

export async function resolveApiKeyWithSource(flag?: string): Promise<KeySource> {
  if (flag && flag.length > 0) {
    return { key: flag, source: "flag" };
  }
  const env = process.env.ANTHROPIC_API_KEY;
  if (env && env.length > 0) {
    return { key: env, source: "env" };
  }
  const fromFile = readConfig().apiKey;
  if (fromFile && fromFile.length > 0) {
    return { key: fromFile, source: "config" };
  }
  const prompted = await promptForKey();
  return { key: prompted, source: "prompt" };
}

export async function resolveApiKey(flag?: string): Promise<string> {
  return (await resolveApiKeyWithSource(flag)).key;
}

export function resolveModel(flag?: string): string {
  if (flag && flag.length > 0) return flag;
  const env = process.env.MINI_AGENT_MODEL;
  if (env && env.length > 0) return env;
  const fromFile = readConfig().model;
  if (fromFile && fromFile.length > 0) return fromFile;
  return DEFAULT_MODEL;
}
