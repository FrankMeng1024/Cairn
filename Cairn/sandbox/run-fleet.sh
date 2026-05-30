#!/bin/bash
# v123 — fleet test. Run simulator across many seeds to confirm
# the algorithm is robust, not just lucky on a single seed.

cd "$(dirname "$0")"
SEEDS=(42 100 7 999 1234 5678 31415 27182 11111 99999)
PASS=0
FAIL=0
for s in "${SEEDS[@]}"; do
  result=$(node simulator.mjs --seed=$s 2>&1 | grep "OVERALL")
  if [[ "$result" == *"PASS"* ]]; then
    echo "seed=$s ✅"
    PASS=$((PASS+1))
  else
    echo "seed=$s ❌  $result"
    FAIL=$((FAIL+1))
  fi
done
echo "==========================="
echo "Fleet result: $PASS/$((PASS+FAIL)) seeds PASS"
[[ $FAIL -eq 0 ]] && echo "✅ ALGORITHM ROBUST" && exit 0 || exit 1
