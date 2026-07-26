# BehaviorOS Recovery

## Recovery Checkpoints
- Created before each phase execution
- Stored in .behavioros/checkpoints.json
- Maximum 50 checkpoints retained

## Context Loss Detection
- Coverage comparison between current and last checkpoint
- Severity levels:
  - None: Coverage drop < 5%
  - Minor: Coverage drop 5-20%
  - Major: Coverage drop 20-50%
  - Critical: Coverage drop > 50%

## Recovery Process
1. Detect context loss
2. Load latest checkpoint
3. Read memory files (.behavioros/*.md)
4. Rebuild context from memory
5. Validate recovery
6. Resume execution

## Self-Healing
- Monitors quality gate failures
- Attempts auto-fix for known patterns
- Rolls back to last known good state if needed
- Maintains healing history
- Escalates after max retries (default: 3)
