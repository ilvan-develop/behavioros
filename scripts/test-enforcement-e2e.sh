#!/bin/bash
# BehaviorOS Enforcement E2E Test
# Real assertions live in test-enforcement-e2e.mjs — this just runs it with `node`.
set -e
node "$(dirname "$0")/test-enforcement-e2e.mjs"
