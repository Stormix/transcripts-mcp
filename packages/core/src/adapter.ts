import type { ZodType } from "zod";

import type { ListOptions, Message, Session, SessionRef, SessionSummary } from "./types";

import { stat } from "node:fs/promises";

import { walkGlob } from "./glob";
import {
  parseJsonLine,
  readHeadJsonlLines,
  readJsonlLines,
  readLastJsonlLine,
  type ParseJsonLineResult,
} from "./jsonl";
import { matchesCwdFilter, resolveTranscriptFile } from "./paths";

export interface TranscriptAdapter {
  readonly id: string;
  readonly displayName: string;
  root(): string;
  isAvailable(): Promise<boolean>;
  listSessions(opts: ListOptions): AsyncIterable<SessionSummary>;
  readSession(ref: SessionRef): Promise<Session>;
  parseRawLine(text: string): Message | null;
  cwdFromRawLine(text: string): string | undefined;
  sessionIdFromPath(path: string): string;
  readonly sessionFiles: string;
}

interface JsonlAdapterSpec<TLine> {
  id: string;
  displayName: string;
  root: () => string;
  sessionFiles: string;
  sessionIdFromPath: (path: string) => string;
  lineSchema: ZodType<TLine>;
  toMessage: (line: TLine) => Message | null;
  titleFromLine?: (line: TLine) => string | undefined;
  cwdFromLine?: (line: TLine) => string | undefined;
  timestampFromLine?: (line: TLine) => Date | undefined;
  projectSlugFromPath?: (path: string) => string | undefined;
}

interface SessionFile {
  path: string;
  mtime: Date;
}

type LineMapResult = { kind: "message"; message: Message } | { kind: "skip" } | { kind: "error" };

export function defineJsonlAdapter<TLine>(spec: JsonlAdapterSpec<TLine>): TranscriptAdapter {
  const parseLine = (text: string) => parseJsonLine(text, spec.lineSchema);

  const mapLine = (line: TLine): LineMapResult => {
    try {
      const message = spec.toMessage(line);
      if (message === null) return { kind: "skip" };
      return { kind: "message", message };
    } catch {
      return { kind: "error" };
    }
  };

  const parseRawLine = (text: string): Message | null => {
    const parsed = parseLine(text);
    if (!parsed.ok) return null;
    const mapped = mapLine(parsed.value);
    switch (mapped.kind) {
      case "message":
        return mapped.message;
      case "skip":
      case "error":
        return null;
      default: {
        const exhaustive: never = mapped;
        return exhaustive;
      }
    }
  };

  const cwdFromRawLine = (text: string): string | undefined => {
    const parsed = parseLine(text);
    if (!parsed.ok) return undefined;
    return spec.cwdFromLine?.(parsed.value);
  };

  const metadataFromLine = (line: TLine) => {
    const mapped = mapLine(line);
    const messageTimestamp = mapped.kind === "message" ? mapped.message.timestamp : undefined;
    return {
      title: spec.titleFromLine?.(line),
      cwd: spec.cwdFromLine?.(line),
      timestamp: spec.timestampFromLine?.(line) ?? messageTimestamp,
    };
  };

  return {
    id: spec.id,
    displayName: spec.displayName,
    root: spec.root,
    async isAvailable() {
      try {
        const info = await stat(spec.root());
        return info.isDirectory();
      } catch {
        return false;
      }
    },
    async *listSessions(opts: ListOptions = {}) {
      if (opts.provider !== undefined && opts.provider !== spec.id) return;
      const root = spec.root();
      if (!(await directoryExists(root))) return;

      const files = await collectSessionFiles(root, spec.sessionFiles);
      let seenCursor = opts.cursor === undefined;
      let yielded = 0;

      for (const file of files) {
        const summary = await summarizeSession(spec, file, parseLine, metadataFromLine);
        if (!matchesListFilters(summary, opts)) continue;
        if (!seenCursor) {
          if (summary.path === opts.cursor || summary.id === opts.cursor) {
            seenCursor = true;
          }
          continue;
        }
        yield summary;
        yielded += 1;
        if (opts.limit !== undefined && yielded >= opts.limit) return;
      }
    },
    async readSession(ref: SessionRef) {
      const filePath = await resolveSessionPath(spec, ref);
      const info = await stat(filePath);
      const messages: Message[] = [];
      let title: string | undefined;
      let cwd: string | undefined;
      let startedAt: Date | undefined;
      let endedAt: Date | undefined;
      let parseErrors = 0;

      for await (const text of readJsonlLines(filePath)) {
        const parsed = parseLine(text);
        if (!parsed.ok) {
          if (text.trim().length === 0) continue;
          if (parsed.reason === "invalid-json") parseErrors += 1;
          continue;
        }
        title ??= spec.titleFromLine?.(parsed.value);
        cwd ??= spec.cwdFromLine?.(parsed.value);
        const extractedTime = spec.timestampFromLine?.(parsed.value);
        startedAt ??= extractedTime;
        if (extractedTime !== undefined) endedAt = extractedTime;

        const mapped = mapLine(parsed.value);
        switch (mapped.kind) {
          case "message":
            messages.push(mapped.message);
            startedAt ??= mapped.message.timestamp;
            if (mapped.message.timestamp !== undefined) endedAt = mapped.message.timestamp;
            break;
          case "skip":
            break;
          case "error":
            parseErrors += 1;
            break;
          default: {
            const exhaustive: never = mapped;
            return exhaustive;
          }
        }
      }

      return {
        id: spec.sessionIdFromPath(filePath),
        provider: spec.id,
        title,
        cwd,
        projectSlug: spec.projectSlugFromPath?.(filePath),
        startedAt,
        endedAt,
        messageCount: messages.length,
        parseErrors,
        path: filePath,
        mtime: info.mtime,
        messages,
      };
    },
    parseRawLine,
    cwdFromRawLine,
    sessionIdFromPath: spec.sessionIdFromPath,
    sessionFiles: spec.sessionFiles,
  };
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function collectSessionFiles(root: string, pattern: string): Promise<SessionFile[]> {
  const files: SessionFile[] = [];
  for await (const absolutePath of walkGlob(root, pattern)) {
    try {
      const info = await stat(absolutePath);
      if (!info.isFile()) continue;
      files.push({ path: absolutePath, mtime: info.mtime });
    } catch {
      continue;
    }
  }
  files.sort((left, right) => {
    const delta = right.mtime.getTime() - left.mtime.getTime();
    if (delta !== 0) return delta;
    if (left.path < right.path) return -1;
    if (left.path > right.path) return 1;
    return 0;
  });
  return files;
}

const summaryHeadLines = 64;

async function summarizeSession<TLine>(
  spec: JsonlAdapterSpec<TLine>,
  file: SessionFile,
  parseLine: (text: string) => ParseJsonLineResult<TLine>,
  metadataFromLine: (line: TLine) => {
    title: string | undefined;
    cwd: string | undefined;
    timestamp: Date | undefined;
  },
): Promise<SessionSummary> {
  const wantsTitle = spec.titleFromLine !== undefined;
  const wantsCwd = spec.cwdFromLine !== undefined;
  let title: string | undefined;
  let cwd: string | undefined;
  let startedAt: Date | undefined;
  let latestHeadTimestamp: Date | undefined;

  for await (const text of readHeadJsonlLines(file.path, summaryHeadLines)) {
    const meta = metadataFromParsed(text, parseLine, metadataFromLine);
    if (meta === undefined) continue;
    title ??= meta.title;
    cwd ??= meta.cwd;
    startedAt ??= meta.timestamp;
    if (meta.timestamp !== undefined) latestHeadTimestamp = meta.timestamp;
    const titleDone = !wantsTitle || title !== undefined;
    const cwdDone = !wantsCwd || cwd !== undefined;
    if (titleDone && cwdDone && startedAt !== undefined) break;
  }

  const last = await readLastJsonlLine(file.path);
  const lastMeta =
    last === null ? undefined : metadataFromParsed(last, parseLine, metadataFromLine);

  return {
    id: spec.sessionIdFromPath(file.path),
    provider: spec.id,
    title: title ?? lastMeta?.title,
    cwd: cwd ?? lastMeta?.cwd,
    projectSlug: spec.projectSlugFromPath?.(file.path),
    startedAt,
    endedAt: lastMeta?.timestamp ?? latestHeadTimestamp,
    path: file.path,
    mtime: file.mtime,
  };
}

function metadataFromParsed<TLine>(
  text: string,
  parseLine: (text: string) => ParseJsonLineResult<TLine>,
  metadataFromLine: (line: TLine) => {
    title: string | undefined;
    cwd: string | undefined;
    timestamp: Date | undefined;
  },
) {
  const parsed = parseLine(text);
  if (!parsed.ok) return undefined;
  return metadataFromLine(parsed.value);
}

function matchesListFilters(summary: SessionSummary, opts: ListOptions): boolean {
  if (opts.cwd !== undefined) {
    if (!matchesCwdFilter(opts.cwd, summary.cwd, summary.projectSlug)) return false;
  }
  const timestamp = summary.startedAt ?? summary.mtime;
  if (opts.since !== undefined && timestamp < opts.since) return false;
  if (opts.until !== undefined && timestamp > opts.until) return false;
  return true;
}

async function resolveSessionPath<TLine>(
  spec: JsonlAdapterSpec<TLine>,
  ref: SessionRef,
): Promise<string> {
  if (ref.provider !== spec.id) {
    throw new Error(`Adapter ${spec.id} cannot read provider ${ref.provider}`);
  }
  if (ref.path !== undefined) {
    const canonicalPath = await resolveTranscriptFile(ref.path, spec.root(), spec.sessionFiles);
    if (spec.sessionIdFromPath(canonicalPath) !== ref.id) {
      throw new Error(`Session id does not match session path: ${ref.provider}/${ref.id}`);
    }
    return canonicalPath;
  }

  const root = spec.root();
  for await (const absolutePath of walkGlob(root, spec.sessionFiles)) {
    if (spec.sessionIdFromPath(absolutePath) === ref.id) {
      return absolutePath;
    }
  }
  throw new Error(`Session not found: ${ref.provider}/${ref.id}`);
}
