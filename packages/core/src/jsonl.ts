import type { ZodType } from "zod";

import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { createInterface } from "node:readline";

const LINE_CHUNK_BYTES = 64 * 1024;

export type ParseJsonLineResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "invalid-json" | "unrecognized" };

export function parseJsonLine<T>(text: string, schema: ZodType<T>): ParseJsonLineResult<T> {
  const payload = stripBom(text);
  try {
    const parsed = schema.safeParse(JSON.parse(payload));
    if (parsed.success) {
      return { ok: true, value: parsed.data };
    }
    return { ok: false, reason: "unrecognized" };
  } catch (cause) {
    if (cause instanceof SyntaxError) return { ok: false, reason: "invalid-json" };
    throw cause;
  }
}

export async function* readJsonlLines(path: string): AsyncIterable<string> {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    let isFirst = true;
    for await (const line of lines) {
      if (isFirst) {
        isFirst = false;
        yield stripBom(line);
        continue;
      }
      yield line;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}

export async function readJsonlLineAt(path: string, lineNumber: number): Promise<string | null> {
  if (lineNumber < 1) return null;
  let current = 0;
  for await (const line of readJsonlLines(path)) {
    current += 1;
    if (current === lineNumber) return line;
  }
  return null;
}

export async function readFirstJsonlLine(path: string): Promise<string | null> {
  const file = await open(path, "r");
  try {
    const chunks: string[] = [];
    let position = 0;
    const buffer = Buffer.alloc(LINE_CHUNK_BYTES);
    for (;;) {
      const result = await file.read(buffer, 0, buffer.length, position);
      if (result.bytesRead === 0) break;
      const text = buffer.toString("utf8", 0, result.bytesRead);
      const newlineAt = text.indexOf("\n");
      if (newlineAt !== -1) {
        const raw = text.slice(0, newlineAt);
        chunks.push(raw.endsWith("\r") ? raw.slice(0, -1) : raw);
        break;
      }
      chunks.push(text);
      position += result.bytesRead;
    }
    if (chunks.length === 0) return null;
    const line = chunks.join("");
    return line.length === 0 ? null : stripBom(line);
  } finally {
    await file.close();
  }
}

export async function readLastJsonlLine(path: string): Promise<string | null> {
  const file = await open(path, "r");
  try {
    const info = await file.stat();
    if (info.size === 0) return null;
    let window = Math.min(LINE_CHUNK_BYTES, info.size);
    for (;;) {
      const position = info.size - window;
      const buffer = Buffer.alloc(window);
      const result = await file.read(buffer, 0, window, position);
      const text = buffer.toString("utf8", 0, result.bytesRead);
      const line = lastCompleteLine(text, position === 0);
      if (line !== null) return stripBom(line);
      if (position === 0) return null;
      window = Math.min(info.size, window * 2);
    }
  } finally {
    await file.close();
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function lastCompleteLine(text: string, readFromStart: boolean): string | null {
  let end = text.length;
  while (end > 0) {
    const character = text[end - 1];
    if (character !== "\n" && character !== "\r") break;
    end -= 1;
  }
  if (end === 0) return null;
  const slice = text.slice(0, end);
  const lastBreak = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf("\r"));
  if (lastBreak === -1) {
    return readFromStart ? slice : null;
  }
  return slice.slice(lastBreak + 1);
}
