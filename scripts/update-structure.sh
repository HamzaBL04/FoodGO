#!/usr/bin/env bash
# Regenerate the project-structure tree in README.md between the markers:
#   <!-- STRUCTURE:START --> ... <!-- STRUCTURE:END -->
# Run it whenever you add/move folders:  ./scripts/update-structure.sh
#
# In a git repository it lists only TRACKED files, two levels deep, so ignored
# things (node_modules, .env, local databases, coverage) never appear.
# Outside git it falls back to `tree`, then `find` (the template's behaviour).
set -euo pipefail

cd "$(dirname "$0")/.."
README="README.md"

TREE_FILE="$(mktemp)"
OUT_FILE="$(mktemp)"
trap 'rm -f "$TREE_FILE" "$OUT_FILE"' EXIT

tracked_tree() {
  local files
  files="$(git ls-files)"
  echo "."
  # Top-level folders (sorted), each with its direct children (files, or sub-folders with a trailing /).
  echo "$files" | grep '/' | cut -d/ -f1 | sort -u | while read -r dir; do
    echo "├── $dir/"
    echo "$files" | grep "^$dir/" | cut -d/ -f2- \
      | awk -F/ '{ if (NF > 1) print $1 "/"; else print $1 }' | sort -u \
      | sed 's/^/│   ├── /'
  done
  # Top-level files.
  echo "$files" | grep -v '/' | sort | sed 's/^/├── /'
}

if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [ -n "$(git ls-files | head -n 1)" ]; then
  tracked_tree > "$TREE_FILE"
elif command -v tree >/dev/null 2>&1; then
  tree -a -L 2 -I '.git|node_modules|.venv|venv|dist|build|__pycache__|.next|coverage|DerivedData' --dirsfirst > "$TREE_FILE"
else
  find . -maxdepth 2 \
      -not -path '*/.git/*' -not -path '*/node_modules/*' \
      -not -path '*/.venv/*' -not -path '*/venv/*' \
      -not -path '*/dist/*' -not -path '*/build/*' \
      -not -path '*/__pycache__/*' -not -path '*/.next/*' \
      -not -path '*/coverage/*' \
      | sed 's|^\./||' | grep -vE '^\.git(/|$)' | sort > "$TREE_FILE"
fi

# Replace the block between the markers. awk reads the tree from a file
# (getline) so there are no multi-line-variable issues on macOS/BSD awk.
awk -v treefile="$TREE_FILE" '
  /<!-- STRUCTURE:START/ {
    print
    print "```"
    while ((getline line < treefile) > 0) print line
    close(treefile)
    print "```"
    skip = 1
    next
  }
  /<!-- STRUCTURE:END/ { skip = 0 }
  skip != 1 { print }
' "$README" > "$OUT_FILE"

mv "$OUT_FILE" "$README"
trap - EXIT
rm -f "$TREE_FILE"
echo "Updated project structure in $README"
