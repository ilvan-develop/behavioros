---
description: Compile DNA packages into generated organizations, agents, and workflows
agent: build
subtask: true
---

Compile DNA packages from the `dnas/` directory into generated output.

## Instructions

1. First validate all DNA packages: run `npx behavioros validate` or check YAML syntax manually
2. Run the BehaviorOS compiler: `npx behavioros compile`
3. If the CLI is not built yet, run `pnpm build` first
4. Report the compilation results:
   - Which DNA packages were compiled
   - Generated organizations, agents, and workflows
   - Any compilation errors or warnings
   - Output location of compiled files

## Output Format

- **Compilation Status**: Success / Partial / Failed
- **Packages Processed**: List of DNA files compiled
- **Generated Artifacts**: Organizations, agents, workflows created
- **Errors**: Any compilation failures with details
- **Next Steps**: What to do with the compiled output
