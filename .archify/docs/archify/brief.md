# Design Brief

Target: `/home/iammbayo/Documents/Projects/dawa-lens`

This brief is internal grounding for the Archify skill. The skill should use it to write root-level `archify.md` as an upload-ready multi-role architecture prompt document.

## Grounded Summary
dawa-lens contains 357 subsystems, 2024 cross-subsystem flows, 0 processed documents, and 3249 external dependencies derived from 8587 extracted code nodes.

## Confirmed Priorities
- Subsystem: `server`
- Subsystem: `src/contexts`
- Subsystem: `src/services`
- Subsystem: `server`
- Subsystem: `src/services`

## Inferred Priorities
- imports x1
- calls x27
- calls x19, imports x1
- calls x71
- calls x3

## Open Questions
- Does `subsystem-0-0-server` really depend on `subsystem-12-0-server` through `calls`?
- Does `subsystem-0-0-server` really depend on `subsystem-171-0-server` through `calls`?
- Does `subsystem-0-0-server` really depend on `subsystem-172-0-server` through `calls`?
- Does `subsystem-0-0-server` really depend on `subsystem-173-0-server` through `calls`?
- Does `subsystem-0-0-server` really depend on `subsystem-174-0-server` through `calls`?

## Writing Rules
- Start from `.archify/docs/archify/packet.json` and only read the referenced artifacts.
- Use the `.archify` artifacts as the primary grounded source of confirmed facts.
- Read the root README listed as `supportingDocuments.primaryReadme` after the `.archify` artifacts when it is present.
- Skip the README step cleanly when `supportingDocuments.primaryReadme` is null.
- Treat `supportingDocuments.additionalDocs` as optional extra context after the README step.
- Write one final file: `archify.md`.
- Base the final `archify.md` on `.archify` knowledge plus README understanding when a README is present.
- Make the final file an upload-ready architecture prompt pack for AI apps such as ChatGPT or Claude.
- Include explicit `System Prompt` and `User Prompt` sections at the top level.
- Include a `Grounded Repository Context` section that carries the repository evidence without replacing the prompt sections.
- Keep confirmed facts separate from inferred architecture.
- Include a `Questions Before Architecture Generation` section and ask those questions before finalizing the architecture.
- The first guided interaction must ask which architecture artifact the user wants, offer multiple options, and allow a custom answer.
- The second guided interaction must ask how the architecture should look visually, offer diagram or image style options, and allow a custom answer.
- Wait for the user's guided answers before generating the final architecture output or visual.
- Include `Diagram / Image Generation Instructions` that tell capable apps to generate the image directly and tell non-image-capable apps to return a render-ready diagram prompt or specification instead.
- Support multiple deliverable types including high-level architecture, low-level architecture, component breakdowns, user flows, sequence or interaction views, and custom requests.
- Do not let README-only claims override grounded `.archify` evidence without marking them as inferred or uncertain.
- Cite evidence references from the packet in each major section.
- Do not create `archify_design.md`, `architecture.md`, `design.md`, or root `diagram-prompt.md` as the main output.
