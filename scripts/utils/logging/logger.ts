import pino from "pino";
import pinoPretty from "pino-pretty";
import pathModule from "path";
import fs from "fs";

const isPretty = !!process.stdout.isTTY;
const level = (process.env.LOG_LEVEL ?? "info").toLowerCase();

const logDir = pathModule.join(process.cwd(), "logs");
fs.mkdirSync(logDir, { recursive: true });
const logFile = pino.destination({ dest: pathModule.join(logDir, "script.log"), append: true, sync: false });

const streamsArr: pino.StreamEntry[] = [{ stream: logFile }];

// Disable terminal logging for "start:dev" so pure console logs are easier to read.
// We check process.argv instead of process.env.npm_lifecycle_event because npx can drop it.
const isStartDev = process.argv.some(arg => arg.endsWith("dev.ts"));
if (!isStartDev) {
  streamsArr.push(
    isPretty
      ? { stream: pinoPretty({ colorize: true }) }
      : { stream: process.stdout }
  );
}

const streams = pino.multistream(streamsArr);

export const logger = pino({ level }, streams);

// Registers crash-safe final log handlers — ensures buffered writes are flushed on uncaught errors.
// pino.final was removed in pino v8; flush manually then exit once the destination drains.
function finalHandler(err: Error | null, evt: string): void {
  logger.info({ evt }, "process exit");
  if (err) logger.error(err, "fatal error");
  logger.flush();
  logFile.on("finish", () => process.exit(err ? 1 : 0));
  logFile.end();
}

process.on("uncaughtException", (err) => finalHandler(err, "uncaughtException"));
process.on("unhandledRejection", (err) => finalHandler(err as Error, "unhandledRejection"));

export function getLogger(module: string) {
  return logger.child({ module });
}
