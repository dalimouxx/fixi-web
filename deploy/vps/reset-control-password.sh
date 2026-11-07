#!/usr/bin/env bash
# Change (ou réinitialise) le mot de passe de Fixi Control, et désactive la double vérification si vous avez perdu votre téléphone.
#   ./reset-control-password.sh                 mot de passe de l'identifiant « platform »
#   ./reset-control-password.sh autre-identifiant
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
login="${1:-platform}"

read -rsp "Nouveau mot de passe (12 caractères minimum) : " pw; echo
read -rsp "Confirmez : " pw2; echo
[ "$pw" = "$pw2" ] || { echo "Les deux mots de passe sont différents." >&2; exit 1; }
[ "${#pw}" -ge 12 ] || { echo "12 caractères minimum." >&2; exit 1; }

read -rp "Désactiver aussi la double vérification (téléphone perdu) ? [o/N] " totp

docker compose exec -T -e NEWPW="$pw" -e LOGIN="$login" -e RESET_TOTP="${totp:-n}" app node -e '
const { PrismaClient } = require("@prisma/client"); const bcrypt = require("bcryptjs");
(async () => {
  const p = new PrismaClient();
  const a = await p.platformAdmin.findUnique({ where: { login: process.env.LOGIN } });
  if (!a) { console.error("Identifiant introuvable : " + process.env.LOGIN); process.exit(2); }
  const data = { passwordHash: await bcrypt.hash(process.env.NEWPW, 12) };
  if (/^[oOyY]/.test(process.env.RESET_TOTP || "")) { data.totpEnabled = false; }
  await p.platformAdmin.update({ where: { id: a.id }, data });
  await p.loginGuard.deleteMany({});
  console.log("✅ Mot de passe mis à jour pour " + process.env.LOGIN + (data.totpEnabled === false ? " (double vérification désactivée)" : ""));
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
'
