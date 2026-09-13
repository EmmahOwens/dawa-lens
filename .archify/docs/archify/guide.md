# Archify Guide Brief

Doc type: `archify`
Output file: `archify.md`

Guide the agent to write `archify.md` from grounded `.archify` artifacts with minimal extra repository reads.

## Read Order
- `.archify/docs/archify/packet.json`
- `.archify/docs/archify/guide.json`
- `.archify/docs/archify/packet.json`
- `.archify/architecture-context.json`
- `.archify/facts.json`
- `.archify/modules.json`
- `.archify/services.json`
- `.archify/dependencies.json`
- `.archify/routes.json`
- `.archify/database.json`
- `.archify/docs-summary.json`
- `README.md`
- `rust/README.md`

## Drafting Workflow
- Read `.archify/docs/archify/packet.json`.
- Read `.archify/docs/archify/guide.json`.
- Read only the artifacts listed in `readOrder`.
- Draft `archify.md` section by section using `sectionPlan`.
- Run section-level validation using each section's `validationChecks`.
- Run final document validation using `validationChecks` before finalizing output.

## Fact Rules
- Confirmed: Only state items as confirmed when they are directly supported by the listed `.archify` artifacts.
- Inferred: Use inferred statements only when synthesized from artifact relationships and label them explicitly as inferred.
- Missing evidence: If the artifacts do not support a claim, state that repository evidence is insufficient instead of guessing.
- Supporting docs: Treat README and optional supporting docs as secondary context that cannot override grounded `.archify` evidence.

## Required Sections
- `System Prompt` from `.archify/docs/archify/packet.json`
  Field: `generationRules.requiredSections`
  Field: `generationRules.documentShape`
  Drafting: Define the assistant role, grounding expectations, and factuality constraints.
  Drafting: State that `.archify` artifacts are the primary source of truth.
  Missing evidence: Do not invent repository facts in this section. Keep it as instruction-only content.
- `User Prompt` from `.archify/docs/archify/packet.json`
  Field: `questionnaireTemplate`
  Field: `generationRules.promptBehavior`
  Drafting: Tell the downstream AI what to produce using the grounded repository context.
  Drafting: Preserve the guided interaction requirements from the packet.
  Missing evidence: Do not add repository-specific claims unless they are already grounded elsewhere in the packet.
- `Grounded Repository Context` from `.archify/architecture-context.json`, `.archify/architecture-context.md`, `.archify/facts.json`, `.archify/modules.json`, `.archify/services.json`, `.archify/routes.json`, `.archify/database.json`, `.archify/dependencies.json`
  Field: `confirmedFromCodebase`
  Field: `groundedRepositoryContext`
  Drafting: Summarize the system, subsystems, interfaces, dependencies, routes, and data concerns from the listed artifacts.
  Drafting: Prefer compact factual statements over exhaustive dumps.
  Missing evidence: If a subsystem or concern is not supported by the listed artifacts, omit it or explicitly mark evidence as insufficient.
- `Confirmed From Codebase` from `.archify/architecture-context.json`, `.archify/facts.json`, `.archify/modules.json`, `.archify/services.json`, `.archify/routes.json`, `.archify/database.json`, `.archify/dependencies.json`
  Field: `confirmedFromCodebase`
  Drafting: Use only packet entries already categorized as confirmed.
  Drafting: Preserve evidence-backed distinctions such as subsystem inventory, interfaces, services, routes, and data stores.
  Missing evidence: If there are few confirmed items for a topic, state that the codebase evidence is limited instead of filling gaps.
- `Inferred Architecture` from `.archify/architecture-context.json`, `.archify/architecture-context.md`
  Field: `inferredArchitecture`
  Drafting: Summarize architectural implications synthesized from grounded relationships.
  Drafting: Use explicit labels such as `Inferred` when describing boundaries, flows, or responsibilities not directly declared.
  Missing evidence: If the packet has no meaningful inferred items, say that no strong additional architectural inference was derived.
- `Open Questions / Uncertainty` from `.archify/architecture-context.json`, `.archify/docs-summary.json`
  Field: `openQuestionsAndUncertainty`
  Drafting: List unresolved architecture questions, ambiguous boundaries, and missing evidence areas.
  Drafting: Keep uncertainty actionable and specific.
  Missing evidence: If the packet has no open questions, state that no major unresolved questions were extracted from the grounded artifacts.
- `Questions Before Architecture Generation` from `.archify/docs/archify/packet.json`
  Field: `questionnaireTemplate.sectionTitle`
  Field: `questionnaireTemplate.questions`
  Drafting: Preserve the packet questionnaire as a pre-generation gating step.
  Drafting: Keep the questions focused on user intent, flows, constraints, and scope.
  Missing evidence: Do not replace the questionnaire with assumptions.
- `Diagram / Image Generation Instructions` from `.archify/docs/archify/packet.json`
  Field: `generationRules.diagramCapabilityPolicy`
  Field: `generationRules.promptBehavior`
  Drafting: Tell capable apps to generate visuals directly and other apps to return render-ready diagram specifications.
  Drafting: Preserve the visual-style question and wait-for-answer requirement.
  Missing evidence: Do not invent diagram content beyond what the grounded context supports.

## Validation Checks
- Read `.archify/docs/archify/packet.json` before any other synthesis artifact.
- Read `.archify/docs/archify/guide.json` before reading repository files outside `.archify`.
- Draft and validate `archify.md` section by section using `sectionPlan`.
- Ensure every major section is traceable to the listed source artifacts.
- Ensure inferred statements are labeled and kept separate from confirmed facts.
- Ensure unsupported claims are replaced with explicit uncertainty or missing-evidence language.
- Ensure the final document includes `System Prompt`, `User Prompt`, `Grounded Repository Context`, `Questions Before Architecture Generation`, and `Diagram / Image Generation Instructions`.

## Forbidden Behaviors
- Do not inspect the whole repository before reading the guide and the referenced `.archify` artifacts.
- Do not present README-only or supporting-doc-only claims as confirmed codebase facts.
- Do not invent rationale, deployment boundaries, or undocumented architecture decisions.
- Do not write any primary output file other than `archify.md`.
