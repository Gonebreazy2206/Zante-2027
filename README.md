# Zante 2027

Gedeelde vakantieplanner voor een vriendengroep.

## Features

- Naam + room key login
- Gedeelde planning per dag
- Events met begin- en eindtijd
- Ideeën per dag
- Gezamenlijke uitgaven
- Gedeelde packing list
- Adminrollen
- Nate is automatisch hoofd-admin
- Admins kunnen leden beheren en alle content verwijderen
- Live synchronisatie via Supabase Realtime

## Projectstructuur

```text
Zante-2027/
├─ index.html
├─ css/
│  └─ styles.css
├─ js/
│  ├─ config.js
│  └─ app.js
├─ sql/
│  ├─ schema.sql
│  └─ migrate-admin-no-votes.sql
├─ .gitignore
└─ README.md
```

## Database bijwerken

Als je de database al had aangemaakt vóór de admin-update:

1. Open Supabase → SQL Editor.
2. Run `sql/migrate-admin-no-votes.sql`.

Voor een nieuwe database kun je direct `sql/schema.sql` uitvoeren.

## Starten

Open `index.html` met VS Code Live Server of serve de map met een lokale webserver.

Gebruik nooit een Supabase secret/service-role key in frontendcode.
