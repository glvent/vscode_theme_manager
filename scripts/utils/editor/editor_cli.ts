import { execFileSync } from "child_process";
import { getLogger } from "../logging/logger";

const log = getLogger("editor_cli");

// Returns true if the given command is found in PATH (Windows: where, Unix: which).
const isInPath = (cmd: string): boolean => {
  try {
    if (process.platform === "win32") {
      execFileSync("where", [cmd], { stdio: "ignore" });
    } else {
      execFileSync("which", [cmd], { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
};

// Returns editor CLI: preferred if in PATH, else the other; null if neither cursor nor code in PATH.
export const resolveEditorCli = (preferred: "cursor" | "code"): "cursor" | "code" | null => {
  if (isInPath(preferred)) {
    log.debug({ cli: preferred }, "preferred CLI found in PATH");
    return preferred;
  }
  log.warn({ preferred }, "preferred CLI not in PATH, trying fallback");
  const other = preferred === "cursor" ? "code" : "cursor";
  if (isInPath(other)) {
    log.info({ cli: other }, "fallback CLI found in PATH");
    return other;
  }
  log.error("neither 'cursor' nor 'code' found in PATH");
  return null;
};

export { isInPath };
