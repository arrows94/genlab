# Genlab Sync-Server

Kleiner [Cloudflare Worker](https://developers.cloudflare.com/workers/) mit einer [D1](https://developers.cloudflare.com/d1/)-Datenbank für den Geräte-Sync (Optionen → Geräte-Sync). Er speichert pro Sync-Code genau einen Spielstand.

- **Ende-zu-Ende-verschlüsselt:** Das Spiel leitet aus dem Sync-Code die Datenbank-ID (SHA-256) und einen AES-256-GCM-Schlüssel ab. Der Server kennt weder den Code noch den Inhalt des Spielstands.
- **Keine Konten, keine personenbezogenen Daten:** Gespeichert werden nur ID, Revision, Zeitpunkt, Geräteart („Android“, „Browser“ …), eine zufällige Geräte-Kennung und der verschlüsselte Spielstand.
- **Konflikte:** Jeder Upload nennt die Revision, auf der er aufbaut. Hat ein anderes Gerät inzwischen geschrieben, antwortet der Server mit `409`, und das Spiel fragt nach.
- **Aufräumen:** Ein täglicher Cron löscht Spielstände, die ein Jahr lang nicht abgeglichen wurden.
- **Kosten:** Ein aktiver Spieler lädt beim Spielen etwa alle 5 Minuten hoch, dazu beim Öffnen und Schließen der App – grob 15–20 Anfragen und geschriebene Zeilen pro Spielstunde, Idle-Zeit im Hintergrund kostet nichts. Das kostenlose Kontingent (D1: 100 000 geschriebene Zeilen pro Tag, Workers: 100 000 Anfragen pro Tag – bitte die aktuellen Zahlen auf den Preisseiten prüfen) reicht damit für einige tausend Spielstunden pro Tag. Ist es erschöpft, lehnt Cloudflare bis Mitternacht (UTC) ab; die Spiele laufen lokal weiter und gleichen danach nach. Darüber hilft der Workers-Paid-Plan (ca. 5 $/Monat).

## Einrichten über GitHub (ohne Terminal)

Der Workflow `.github/workflows/sync-server.yml` erledigt alles: Datenbank anlegen (in der EU), Tabellen anlegen, Worker veröffentlichen. Er lässt sich jederzeit erneut starten; vorhandene Spielstände bleiben erhalten.

1. **Cloudflare-Konto** anlegen (kostenlos) und im Dashboard einmal **Workers & Pages** öffnen. Dort wird beim ersten Mal eine eigene `….workers.dev`-Subdomain festgelegt – ohne sie kann nichts veröffentlicht werden.
2. **Account-ID** kopieren: steht im Dashboard unter *Workers & Pages* rechts (bzw. im Menü „Account ID kopieren“).
3. **API-Token** anlegen: Profil → *API Tokens* → *Create Token* → Vorlage **„Edit Cloudflare Workers“** → unter *Permissions* eine Zeile ergänzen: *Account* · **D1** · **Edit** → Token erstellen und kopieren (wird nur einmal angezeigt).
4. Auf GitHub: *Settings → Secrets and variables → Actions* → **New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = das Token
   - `CLOUDFLARE_ACCOUNT_ID` = die Account-ID
5. *Actions* → **„Sync-Server (Cloudflare)“** → *Run workflow*. (Der Workflow erscheint dort erst, wenn er auf `main` liegt.)
6. Die Zusammenfassung des Laufs zeigt die URL, z. B. `https://genlab-sync.<name>.workers.dev`. Sie als **Variable** eintragen: *Settings → Secrets and variables → Actions → Variables* → `SYNC_URL`.
7. *Actions* → **„Web-App (GitHub Pages)“** → *Run workflow*. Ab jetzt steht in den Optionen der Geräte-Sync.

## Einrichten im Terminal (Alternative)

Voraussetzung: ein kostenloses Cloudflare-Konto und Node.js.

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

Den Worker später aktualisieren: `npx wrangler deploy` (bzw. den GitHub-Workflow erneut starten).

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

- Der Worker lehnt IDs ab, die keine 64 Hex-Zeichen sind, und Spielstände über 512 KB. Den Body liest er höchstens
  bis zu dieser Grenze, auch ohne oder mit falschem `Content-Length`.
- Gerätenamen dürfen keine Steuerzeichen enthalten. Ein `savedAt` mehr als einen Tag in der Zukunft wird gekappt.
- **Rate-Limits** je IP (`[[ratelimits]]` in `wrangler.toml`): 60 Anfragen pro Minute insgesamt, 5 neue Spielstände
  pro Minute. Darüber antwortet der Worker mit `429`. Ohne die Bindings (z. B. lokal) gibt es keine Grenze.
- **Optional:** `ALLOWED_ORIGINS` (Worker-Variable, Komma-Liste) beschränkt, welche Web-Ursprünge die API aus dem
  Browser aufrufen dürfen. Ohne Variable sind alle erlaubt. Das bindet nur Browser – vor Missbrauch schützen die
  Rate-Limits. Wer es setzt, muss alle Ursprünge der App aufzählen (GitHub Pages, Capacitor, Tauri), sonst geht der
  Sync dort nicht mehr.
