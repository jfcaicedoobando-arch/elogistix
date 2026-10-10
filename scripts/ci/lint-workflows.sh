#!/usr/bin/env bash
# Valida workflows dentro del detector de CI; sin un workflow separado.
set -euo pipefail
version=1.7.12
temp=$(mktemp -d)
trap 'rm -rf -- "$temp"' EXIT
base="https://github.com/rhysd/actionlint/releases/download/v${version}"
archive="actionlint_${version}_linux_amd64.tar.gz"
curl --connect-timeout 15 --max-time 90 -sSfL -o "$temp/$archive" "$base/$archive"
curl --connect-timeout 15 --max-time 90 -sSfL -o "$temp/checksums.txt" "$base/actionlint_${version}_checksums.txt"
(cd "$temp"; grep " ${archive}\$" checksums.txt | sha256sum -c -)
tar -xzf "$temp/$archive" -C "$temp" actionlint
"$temp/actionlint" -color
