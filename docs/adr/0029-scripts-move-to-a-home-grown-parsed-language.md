---
status: accepted (supersedes adr/0009)
---

# Scripts move to a home-grown parsed language, replacing the TypeScript builder

ADR-0009 chose a TypeScript builder over a parsed DSL and named its own trigger for reconsidering: non-programmer authoring becoming real. ADR-0013 sharpened that trigger to "an author who needs to build or rearrange the branching itself". Both have now happened. Designers need to write branching Dialogue and Cutscenes, and developers find the builder hard to follow too: a Dialogue is its lines followed by its choices, and deeper branches hang off `next` closures, so a larger Script reads inside-out rather than top to bottom. We decided to write our own small scripting language, with a parser and interpreter in their own package outside `engine-core`, and to port every existing TypeScript Script to it and then remove the TypeScript path.

## Considered Options

- **Adopt Yarn Spinner or Ink as-is.** Both are mature, and their prior art is surveyed in `docs/research/dialogue-and-choice-script-functionality.md`. We rejected adopting either for now because the team explicitly wants to learn language design by building one. We accept that we will own the parser, its error messages, and any editor support: the cost ADR-0009 set out to avoid. The language is kept deliberately small to cap that cost.
- **Keep TypeScript, with a top-to-bottom runner.** This would fix the reading order for developers. It does nothing for designers authoring branching.
- **Keep both paths permanently.** We rejected this. Two authoring paths for the same Script concept would double every future feature.
