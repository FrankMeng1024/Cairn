#!/bin/bash
# enforce-qa-gate.sh
# Pre-tool-use hook: blocks marking Stories/Sprints complete without evidence.
# Reads tool input JSON from stdin. Exit 0 = allow, Exit 1 = block.

INPUT=$(cat 2>/dev/null || echo "{}")

FILE_PATH=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('file_path', ''))
except:
    print('')
" 2>/dev/null || echo "")

CONTENT=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('content', data.get('new_string', '')))
except:
    print('')
" 2>/dev/null || echo "")

[ -z "$FILE_PATH" ] && exit 0

FILE_PATH=$(echo "$FILE_PATH" | sed 's|\\|/|g')
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
PROJECT_ROOT=$(echo "$PROJECT_ROOT" | sed 's|\\|/|g')

# --- Story marked Done → check QA evidence exists ---
if echo "$FILE_PATH" | grep -q "tasks/jira/sprint[0-9]*/STORY-"; then
    if echo "$CONTENT" | grep -qi "Status.*Done"; then
        SPRINT=$(echo "$FILE_PATH" | grep -oP 'sprint\K[0-9]+' || echo "")
        if [ -n "$SPRINT" ] && [ ! -d "$PROJECT_ROOT/docs/qa/sprint${SPRINT}-evidence" ]; then
            echo "BLOCKED: No QA evidence for Sprint $SPRINT. Run QA verification first." >&2
            exit 1
        fi
    fi
fi

# --- Sprint Goal marked complete → check verdict + UX review ---
if echo "$FILE_PATH" | grep -q "SPRINT_GOAL.md"; then
    if echo "$CONTENT" | grep -qi "completed\|已完成"; then
        SPRINT=$(echo "$FILE_PATH" | grep -oP 'sprint\K[0-9]+' || echo "")
        if [ -n "$SPRINT" ]; then
            VERDICT="$PROJECT_ROOT/docs/qa/sprint${SPRINT}-verdict.md"
            UX_REVIEW="$PROJECT_ROOT/docs/ux/sprint${SPRINT}-review.md"
            [ ! -f "$VERDICT" ] && echo "BLOCKED: QA verdict missing for Sprint $SPRINT." >&2 && exit 1
            grep -q "Verdict.*PASS" "$VERDICT" 2>/dev/null || { echo "BLOCKED: QA verdict is not PASS." >&2; exit 1; }
            [ ! -f "$UX_REVIEW" ] && echo "BLOCKED: UX review missing for Sprint $SPRINT." >&2 && exit 1

            # If Virtual User is activated (acceptance_mode: auto), check acceptance
            VU_KNOWLEDGE="$PROJECT_ROOT/docs/virtual-user/knowledge.md"
            if [ -f "$VU_KNOWLEDGE" ]; then
                VU_ACCEPTANCE="$PROJECT_ROOT/docs/virtual-user/sprint${SPRINT}-acceptance.md"
                [ ! -f "$VU_ACCEPTANCE" ] && echo "BLOCKED: Virtual User acceptance missing for Sprint $SPRINT." >&2 && exit 1
                grep -q "ACCEPTED" "$VU_ACCEPTANCE" 2>/dev/null || { echo "BLOCKED: Virtual User has not accepted Sprint $SPRINT." >&2; exit 1; }
            fi
        fi
    fi
fi

# --- PROJECT_STATE.md completion ---
if echo "$FILE_PATH" | grep -q "PROJECT_STATE.md"; then
    if echo "$CONTENT" | grep -qi "已完成\|complete"; then
        LATEST=$(echo "$CONTENT" | grep -oP 'Sprint \K[0-9]+' | sort -n | tail -1 || echo "")
        if [ -n "$LATEST" ]; then
            VERDICT="$PROJECT_ROOT/docs/qa/sprint${LATEST}-verdict.md"
            [ ! -f "$VERDICT" ] && echo "BLOCKED: QA verdict missing for Sprint $LATEST." >&2 && exit 1
            grep -q "Verdict.*PASS" "$VERDICT" 2>/dev/null || { echo "BLOCKED: QA verdict is not PASS." >&2; exit 1; }
        fi
    fi
fi

exit 0
