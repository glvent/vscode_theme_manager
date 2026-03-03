import pathModule from "path";
import fs from "fs";
import { getLogger } from "../logging/logger";

const log = getLogger("editor_cache");

// Returns cached { pid, cli } if that PID is still the editor (validates via command line); otherwise null.
export const readEditorCache = (
  extPath: string,
  cacheFile: string,
  getCommandLine: (pid: number) => string
): { pid: number; cli: "cursor" | "code" } | null => {
  const file = pathModule.join(extPath, cacheFile);
  try {
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw) as { pid?: number; cli?: string };
    if (typeof data.pid !== "number" || (data.cli !== "cursor" && data.cli !== "code")) return null;
    const cmd = (getCommandLine(data.pid) || "").toLowerCase();
    if (!cmd.includes(data.cli)) return null;
    return { pid: data.pid, cli: data.cli as "cursor" | "code" };
  } catch (err) {
    log.debug({ err }, "readEditorCache: cache miss or invalid");
    return null;
  }
};

// Writes { pid, cli } to the project cache file. Logs a warning on write failure.
export const writeEditorCache = (extPath: string, cacheFile: string, pid: number, cli: "cursor" | "code"): void => {
  const file = pathModule.join(extPath, cacheFile);
  try {
    const dir = pathModule.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ pid, cli }, null, 0), "utf8");
  } catch (err) {
    log.warn({ err }, "could not write cache");
  }
};
