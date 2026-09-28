# Zante 2027

Gedeelde vakantieplanner voor een vriendengroep.

## Features

- Naam + room key login
- Gedeelde planning per dag
- Events met begin- en eindtijd
- Direct stemmen op events in de planning
- Ideeën + aparte stemmen
- Ranking van populairste events per dag
- Gezamenlijke uitgaven
- Gedeelde packing list
- Live synchronisatie via Supabase Realtime

## Projectstructuur

```text
zante-2027/
├─ index.html
├─ css/
│  └─ styles.css
├─ js/
│  ├─ config.js
│  └─ app.js
├─ sql/
│  └─ schema.sql
├─ assets/
├─ .gitignore
└─ README.md
```

## Starten

Open `index.html` met VS Code Live Server of serve de map met een simpele lokale webserver.

## Supabase

1. Open Supabase SQL Editor.
2. Run `sql/schema.sql`.
3. Controleer `js/config.js` voor de Supabase URL en publishable key.

Gebruik nooit een Supabase secret/service-role key in frontendcode.
