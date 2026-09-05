import { ArrowDownRight } from "lucide-react";

export function SessionPreview() {
  return (
    <figure className="transcript-preview min-w-0">
      <figcaption className="mb-6 flex items-center justify-between gap-4 text-sm text-soft">
        <span>In your current chat</span>
        <span>Example conversation</span>
      </figcaption>
      <blockquote className="transcript-question font-display text-2xl leading-snug font-medium tracking-[-0.02em] sm:text-3xl">
        “Find where we fixed the checkout retry bug in Cursor.”
      </blockquote>
      <div className="transcript-call my-6 flex items-center gap-3 text-coral">
        <ArrowDownRight className="size-5 shrink-0" />
        <code className="text-xs sm:text-sm">grep_transcripts → get_transcript</code>
      </div>
      <div className="transcript-result border-y border-line py-5">
        <p className="mb-3 font-mono text-xs text-soft">Cursor / checkout-api</p>
        <p className="text-base leading-relaxed text-paper">
          “Use a client-supplied{" "}
          <mark className="transcript-match px-1 text-paper">Idempotency-Key</mark> header so a
          replayed POST returns the original result.”
        </p>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-soft">
        Your agent can read the original conversation and pick up the work.
      </p>
    </figure>
  );
}
