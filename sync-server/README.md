# Genlab Sync-Server

Kleiner [Cloudflare Worker](https://developers.cloudflare.com/workers/) mit einer [D1](https://developers.cloudflare.com/d1/)-Datenbank für den Geräte-Sync (Optionen → Geräte-Sync). Er speichert pro Sync-Code genau einen Spielstand.

- **Ende-zu-Ende-verschlüsselt:** Das Spiel leitet aus dem Sync-Code die Datenbank-ID (SHA-256) und einen AES-256-GCM-Schlüssel ab. Der Server kennt weder den Code noch den Inhalt des Spielstands.
- **Keine Konten, keine personenbezogenen Daten:** Gespeichert werden nur ID, Revision, Zeitpunkt, Geräteart („Android“, „Browser“ …), eine zufällige Geräte-Kennung und der verschlüsselte Spielstand.
- **Konflikte:** Jeder Upload nennt die Revision, auf der er aufbaut. Hat ein anderes Gerät inzwischen geschrieben, antwortet der Server mit `409`, und das Spiel fragt nach.
- **Aufräumen:** Ein täglicher Cron löscht Spielstände, die ein Jahr lang nicht abgeglichen wurden.
- **Kosten:** Das kostenlose Cloudflare-Kontingent reicht für viele Spieler (D1: 100 000 Schreibvorgänge pro Tag; ein aktiver Spieler lädt etwa alle 2 Minuten und beim Wechsel hoch).

## Einrichten (einmalig)

Voraussetzung: ein kostenloses Cloudflare-Konto.

```bash
cd sync-server
npx wrangler login
npx wrangler d1 create genlab-sync            # gibt eine database_id aus → in wrangler.toml eintragen
npx wrangler d1 execute genlab-sync --remote --file schema.sql
npx wrangler deploy                           # gibt die URL aus, z. B. https://genlab-sync.<konto>.workers.dev
```

Dann dem Spiel die URL mitgeben:

- **GitHub:** Settings → Secrets and variables → Actions → *Variables* → `SYNC_URL` = die Worker-URL. Die Workflows für Web-App, Android und Desktop reichen sie als `VITE_SYNC_URL` an den Build weiter.
- **Lokal:** `VITE_SYNC_URL=https://… npm run build` (oder in einer `.env.local`).

Ohne `VITE_SYNC_URL` blendet das Spiel den Geräte-Sync aus.

## Lokal testen

```bash
cd sync-server
npx wrangler d1 execute genlab-sync --local --file schema.sql
npx wrangler dev                              # http://localhost:8787
# zweites Terminal, im Hauptordner:
VITE_SYNC_URL=http://localhost:8787 npm run dev
```

Die Server-Logik (`src/handler.ts`) wird zusammen mit dem Client in `tests/sync.test.ts` getestet.

## API

| Methode | Pfad | Antwort |
|---|---|---|
| `GET` | `/v1/saves/:id` | `200 { rev, savedAt, device, writer, recent, data }` oder `404` |
| `PUT` | `/v1/saves/:id` mit `{ baseRev, savedAt, device, writer, data }` | `200 { rev }`, `409 { rev, savedAt, device, writer }` (jemand war schneller) oder `404` (gelöscht) |
| `DELETE` | `/v1/saves/:id` | `204` |

`baseRev: 0` legt einen neuen Spielstand an. `recent` listet, wer die letzten 20 Revisionen geschrieben hat. Daran erkennt ein Gerät seinen eigenen Upload, dessen Antwort beim Schließen der Seite verloren ging.

## Schutz vor Missbrauch

Der Worker lehnt IDs ab, die keine 64 Hex-Zeichen sind, und Spielstände über 512 KB. Für eine öffentliche Instanz empfiehlt sich zusätzlich eine [Rate-Limiting-Regel](https://developers.cloudflare.com/waf/rate-limiting-rules/) für die Worker-Route im Cloudflare-Dashboard (z. B. 60 Anfragen pro Minute und IP).
