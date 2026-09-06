---
name: humanizer
description: Remove AI tells from prose so it reads like a person wrote it.
license: MIT
metadata:
  source: blader/humanizer
  source-url: https://github.com/blader/humanizer
---

# Humanizer

Strip the visible signature of LLM-generated writing from a piece of text. Use when reviewing your own drafts, editing a teammate's, or rewriting AI output before it goes anywhere a reader will see it.

The point is not to be undetectable. The point is to be honest — text that reads like a real person made it because a real person made the calls.

## When to use

- You wrote a draft alongside an LLM and the seams show.
- A doc, README, blog post, PR description or product copy needs a final pass.
- You are reviewing someone else's writing and it feels off but you can't say why.

## What to look for

- **Inflated symbolism.** "X represents a paradigm shift in how we think about Y." Cut.
- **Promotional voice in neutral contexts.** "Robust, scalable, cutting-edge." Replace with concrete claims or delete.
- **Superficial -ing analyses.** "Highlighting", "showcasing", "emphasizing" stacked end to end. Pick verbs that do work.
- **Vague attribution.** "Some experts argue" — name them or drop the claim.
- **Em dash flood.** One per paragraph at most. Otherwise rewrite.
- **Rule of three.** Three-item lists where two would do, especially when items are near-synonyms. Compress.
- **AI vocabulary.** "Delve", "leverage", "tapestry", "underscores", "in the realm of", "navigate the complexities of". Replace.
- **Negative parallelism.** "Not just X, but Y." Most of the time Y alone is the actual sentence.
- **Filler.** "It's important to note that…", "In conclusion…", "Ultimately…". Cut.
- **Hedging without commitment.** "May potentially be able to help in some cases." Pick a side.

## How to apply

1. Read the whole thing once. Mark anything that triggers the list above.
2. Rewrite for voice: shorter sentences, concrete subjects, working verbs.
3. Cut anything that does not advance the argument.
4. Read it out loud. If your mouth trips, the reader's eye trips.

## Output should feel like

- Specific. Names, numbers, examples.
- Slightly uneven cadence — humans do not write to a metronome.
- Comfortable saying "I think" or "I don't know".

## Related

- [[frontend-design]] — same instinct, applied to UI.
- [[skills-index]] — vault catalog.
