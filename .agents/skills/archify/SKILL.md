---
name: archify
description: Build grounded repository architecture documents for the current repository. Defaults to `archify.md`, and also supports the other Archify doc types through `--doc-type`.
---

# archify

Version: 1

Use this skill when the user wants grounded repository architecture documentation in Codex.

Supported documents:
- `archify` -> `archify.md`
- `tech_stack` -> `TECH_STACK.md`
- `api_design` -> `API_DESIGN.md`
- `data_model` -> `DATA_MODEL.md`
- `conventions` -> `CONVENTIONS.md`
- `glossary` -> `GLOSSARY.md`
- `flows` -> `FLOWS.md`
- `test_cases` -> `TEST_CASES.md`

Workflow:
1. Default to doc type `archify` when the user simply says to use Archify on the repo.
2. If the user clearly asks for another supported document, select that doc type and use `--doc-type <type>` on `status`, `generate`, and `write`.
3. Start by checking `npx archify-cli status --doc-type <type>`.
4. If setup is missing, ask for permission before starting `npx archify-cli init --install-mode project --project-path . --platform codex`.
5. If repository knowledge is missing or stale, ask for permission before starting `npx archify-cli analyze .`.
6. If the synthesis packet is missing or stale for the selected doc type, ask for permission before starting `npx archify-cli generate . --doc-type <type>`.
7. After `generate`, run `npx archify-cli status --doc-type <type>` again and only continue if the synthesis packet is ready and not stale.
8. Read `.archify/docs/<type>/packet.json` first.
9. Read `.archify/docs/<type>/guide.json` second and follow its read order, section plan, fact policy, and validation checks before inspecting anything else.
10. Read the referenced `.archify/` artifacts next. These are the mandatory primary grounding.
11. Write one root-level file matching the selected doc type only.

Rules:
- `archify` remains the default doc type for existing workflows.
- Treat `.archify` artifacts as the primary source of confirmed facts.
- Keep confirmed findings, inferred notes, and open questions separate.
- If evidence is weak, say that repository evidence is limited instead of guessing.
- Do not write a different output file than the one mapped to the selected doc type.
- If the selected output file already exists, ask for permission before overwriting it.
