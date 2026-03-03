import pathModule from "path";
import { createInterface } from "readline";
import { spawn } from "child_process";
import { findLikelyEditorPid, getCommandLine } from "../utils/editor/editor_pid";
import { resolveEditorCli } from "../utils/editor/editor_cli";
import { readEditorCache, writeEditorCache } from "../utils/editor/editor_cache";
import { getLogger } from "../utils/logging/logger";

const log = getLogger("start_dev");
const extPath = pathModule.resolve(__dirname, "..", "..");
const appName = (process.env.TERM_PROGRAM || "code").toLowerCase();

const CACHE_FILE = pathModule.join("logs", "editor-pid.json");

// Starts watch (if requested) and launches the editor with the extension development path.
const run = (cli: string, watch: boolean): void => {
  if (watch) {
    log.info("starting npm run watch in background");
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    spawn(npm, ["run", "watch"], {
      cwd: extPath,
      detached: true,
      stdio: "ignore",
      shell: false,
    }).unref();
  }
  log.info({ cli, extPath }, "launching editor");
  spawn(cli, ["--extensionDevelopmentPath", extPath], {
    stdio: "inherit",
    shell: false,
  });
};

function main(): void {
  log.info({ extPath, TERM_PROGRAM: process.env.TERM_PROGRAM ?? "(unset)" }, "config");

  let preferredCli: "cursor" | "code" = "code";
  const cached = readEditorCache(extPath, CACHE_FILE, getCommandLine);

  // Chooses preferred CLI ('cursor' or 'code') using cache or auto-detection.
  if (cached) {
    preferredCli = cached.cli;
    log.info({ cachedPid: cached.pid, preferredCli }, "using cached editor PID");
  } else {
    try {
      const pid = findLikelyEditorPid(appName);
      const cmdLine = (getCommandLine(pid) || "").toLowerCase();
      preferredCli = cmdLine.includes("cursor") ? "cursor" : "code";
      log.info({ pid, preferredCli }, "editor PID");
      writeEditorCache(extPath, CACHE_FILE, pid, preferredCli);
    } catch (err) {
      preferredCli = appName === "cursor" ? "cursor" : "code";
      log.info({ err, preferredCli }, "PID detection failed, using preferredCli");
    }
  }

  const cli = resolveEditorCli(preferredCli);
  log.info({ cli }, "resolved CLI");

  if (cli === null) {
    log.error("Neither 'cursor' nor 'code' was found in PATH. Install the shell command from your editor (Command Palette).");
    process.exit(1);
  }

  // Ask user about watch mode unless stdin is not a TTY.
  if (!process.stdin.isTTY) {
    log.info("stdin is not a TTY; skipping watch prompt, launching without watch");
    run(cli, false);
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write("Watch and recompile? (y/n) ");
    rl.question("", (answer: string) => {
      rl.close();
      run(cli, answer.trim().toLowerCase().startsWith("y"));
    });
  }
}

main();
