import { Container } from "./container";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-coral text-ink">
      <Container className="grid gap-8 py-14 lg:grid-cols-2 lg:gap-20 lg:py-20">
        <h2 className="max-w-[16ch] font-display text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl">
          You already had this conversation.
        </h2>
        <div className="flex flex-col justify-center gap-4 text-lg leading-relaxed">
          <p>
            Cursor, Claude Code, and Codex save transcripts on your machine. Connect transcripts-mcp
            to your client and ask your agent to find what you need.
          </p>
          <p>No exports. No copying chats between tools.</p>
        </div>
      </Container>
    </section>
  );
}
