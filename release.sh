#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <new-version> [release-title]"
  exit 1
fi

NEW_VERSION="$1"
TAG="v${NEW_VERSION}"
RELEASE_TITLE="${2:-${TAG}}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required"
  exit 1
fi

if [ -z "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
  if ! gh auth status >/dev/null 2>&1; then
    echo "GitHub CLI is not authenticated"
    echo "Run: gh auth login"
    echo "Or run with token: GH_TOKEN=your_token ./release.sh <new-version> [release-title]"
    exit 1
  fi
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean"
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "${CURRENT_BRANCH}" = "HEAD" ]; then
  echo "Detached HEAD is not supported"
  exit 1
fi

if git rev-parse "${TAG}" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists locally"
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists on origin"
  exit 1
fi

node -e "const fs=require('node:fs');const p='package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.version=process.argv[1];fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');" "${NEW_VERSION}"

git add package.json
git commit -m "chore(release): ${TAG}"
git tag -a "${TAG}" -m "${TAG}"
git push origin "${CURRENT_BRANCH}"
git push origin "${TAG}"
gh release create "${TAG}" --title "${RELEASE_TITLE}" --generate-notes

echo "Release ${TAG} created and published"
