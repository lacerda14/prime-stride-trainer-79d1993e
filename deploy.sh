#!/usr/bin/env bash
# Deploy do PM Hybrid no Cloudflare Worker (frontend + server functions).
#
# IMPORTANTE: o build do Nitro gera um wrangler.json com
# compatibility_date = 2024-09-23. Nessa data o Cloudflare NÃO popula
# process.env com os secrets do worker, então o auth-middleware (que lê
# process.env.SUPABASE_URL) quebra e o app zera tudo (0 XP, sem treino).
# Este script força a data >= 2025-04-01 antes de deployar.
#
# O Nitro ALTERNA o diretório de saída entre `.output/` e `dist/` dependendo
# da versão do @lovable.dev/vite-tanstack-config. Por isso detectamos qual
# wrangler.json foi gerado mais recentemente, em vez de fixar o caminho.
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Build..."
# Limpa saídas antigas pra não deployar bundle obsoleto por engano.
rm -rf .output dist
bun run build

# Detecta onde o build saiu (.output/server ou dist/server).
WRANGLER=""
for p in .output/server/wrangler.json dist/server/wrangler.json; do
  if [ -f "$p" ]; then WRANGLER="$p"; break; fi
done
if [ -z "$WRANGLER" ]; then
  echo "✗ ERRO: wrangler.json não encontrado em .output/server nem dist/server."
  echo "  Conteúdo gerado:"; ls -d .output dist 2>/dev/null
  exit 1
fi
echo "→ Usando config: $WRANGLER"

echo "→ Corrigindo compatibility_date do worker (fix process.env/secrets)..."
WRANGLER_PATH="$WRANGLER" python3 - <<'PY'
import json, os
p = os.environ["WRANGLER_PATH"]
c = json.load(open(p))
c["compatibility_date"] = "2025-04-01"
flags = set(c.get("compatibility_flags", []))
flags.add("nodejs_compat")
c["compatibility_flags"] = sorted(flags)
json.dump(c, open(p, "w"), indent=2)
print("   compatibility_date =", c["compatibility_date"], "| flags =", c["compatibility_flags"])
PY

echo "→ Deploy no Cloudflare..."
npx wrangler deploy --config "$WRANGLER"

echo "✓ Deploy concluído ($WRANGLER). Secrets necessários: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY"
