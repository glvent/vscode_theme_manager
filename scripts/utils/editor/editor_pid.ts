import { execFileSync } from "node:child_process";
import { getLogger } from "../logging/logger";

const log = getLogger("editor_pid");

// Max ancestor PIDs to walk before stopping (avoids infinite loops).
const MAX_DEPTH = 50;

let vscode: typeof import("vscode") | null = null;
try {
  vscode = require("vscode");
} catch {
  // Not in extension host (e.g. run from terminal).
}

// Returns parent PID or full command line for a process (Windows: PowerShell, Unix: ps).
const execForPid = (pid: number, kind: "parent" | "command"): string => {
  if (process.platform === "win32") {
    const prop = kind === "parent" ? "ParentProcessId" : "CommandLine";
    return execFileSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").${prop}`,
    ], { encoding: "utf8" }).trim();
  }
  const format = kind === "parent" ? "ppid=" : "command=";
  return execFileSync("ps", ["-o", format, "-p", String(pid)], { encoding: "utf8" }).trim();
};

// Returns the parsed parent process ID, or null if unavailable.
const getParentPid = (pid: number): number | null => {
  try {
    const out = execForPid(pid, "parent");
    const n = Number(out);
    return Number.isFinite(n) ? n : null;
  } catch (err) {
    log.debug({ pid, err }, "getParentPid failed");
    return null;
  }
};

// Returns the full command line for the given process, or "" if the query fails.
export const getCommandLine = (pid: number): string => {
  try {
    return execForPid(pid, "command");
  } catch (err) {
    log.debug({ pid, err }, "getCommandLine failed");
    return "";
  }
};

// Yields ancestor PIDs from startPid up the parent chain until root or MAX_DEPTH.
// Uses ppid <= 1 for cross-platform root detection (Windows root is not always PID 1).
const walkAncestorPids = function* (startPid: number = process.pid): Generator<number> {
  let pid = startPid;
  for (let i = 0; i < MAX_DEPTH; i++) {
    yield pid;
    const ppid = getParentPid(pid);
    if (!ppid || ppid <= 1) break;
    pid = ppid;
  }
};

// Returns the topmost ancestor PID (last before init/root).
export const findTopEditorPid = (): number => {
  let last = process.pid;
  for (const pid of walkAncestorPids()) last = pid;
  return last;
};

// Returns first ancestor whose command line matches the editor app name, or top ancestor PID.
// From Node pass appName (e.g. process.env.TERM_PROGRAM or "code").
export const findLikelyEditorPid = (appName?: string): number => {
  const name = (appName ?? vscode?.env?.appName ?? "").toLowerCase();
  log.info({ appName: name || "(none)" }, "findLikelyEditorPid");
  let last = process.pid;
  for (const pid of walkAncestorPids()) {
    last = pid;
    const cmd = (getCommandLine(pid) || "").toLowerCase();
    if (name && cmd.includes(name)) {
      log.info({ pid }, "matched PID (command includes app name)");
      return pid;
    }
  }
  log.info({ pid: last }, "no match; using top ancestor PID");
  return last;
};
