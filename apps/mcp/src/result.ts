import * as z from "zod/v4";

const caughtSchema = z.object({ message: z.string() });

export function jsonResult<T>(value: T) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export async function runTool<T>(run: () => Promise<T>) {
  try {
    return jsonResult(await run());
  } catch (error) {
    const parsed = caughtSchema.safeParse(error);
    return errorResult(parsed.success ? parsed.data.message : "unknown error");
  }
}
