#!/usr/bin/env bash
set -euo pipefail

API_BASE="${1:-http://127.0.0.1:4000}"

echo "# Health"
curl -sS "$API_BASE/health" | jq . >/dev/null || true

PDF1="apps/sign-pdf-react/big-test.pdf"
PDF2="apps/sign-pdf-react/big-test.pdf"

echo "\n# Success merge"
curl -sS -F "files[]=@$PDF1" -F "files[]=@$PDF2" "$API_BASE/v1/pdf/merge" | jq .

echo "\n# Too many files"
for i in {1..22}; do echo -n "-F files[]=@$PDF1 "; done > /tmp/args.txt
xargs -n 100 curl -sS "$API_BASE/v1/pdf/merge" < /tmp/args.txt | jq . || true

echo "\n# Payload too large (simulate by repeating a file)"
for i in {1..8}; do echo -n "-F files[]=@$PDF1 "; done > /tmp/args2.txt
xargs -n 100 curl -sS "$API_BASE/v1/pdf/merge" < /tmp/args2.txt | jq . || true

echo "\n# Invalid type"
echo test > /tmp/not.pdf
curl -sS -F "files[]=@/tmp/not.pdf" -F "files[]=@$PDF1" "$API_BASE/v1/pdf/merge" | jq . || true

echo "\n# Encrypted without password (should 422)"
# Supply your own encrypted file path if available
if [[ -n "${ENCRYPTED_PDF:-}" ]]; then
  curl -sS -F "files[]=@$PDF1" -F "files[]=@$ENCRYPTED_PDF" "$API_BASE/v1/pdf/merge" | jq . || true
fi

echo "Done."

