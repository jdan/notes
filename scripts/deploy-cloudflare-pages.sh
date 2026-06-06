#!/usr/bin/env bash
set -euo pipefail

project_name="${CLOUDFLARE_PAGES_PROJECT_NAME:?Set CLOUDFLARE_PAGES_PROJECT_NAME}"
output_dir="${BUILD:-build}"
branch="${CLOUDFLARE_PAGES_BRANCH:-main}"

npx wrangler pages deploy "$output_dir" --project-name "$project_name" --branch "$branch"
