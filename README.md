# Zante 2027

Gedeelde vakantieplanner, nu voorbereid als echte iPhone-app met Capacitor + Supabase.

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
- iPhone/iOS-ready via Capacitor
- iPhone safe-area ondersteuning voor notch en home indicator

## Projectstructuur

```text
Zante-2027/
├─ index.html
├─ css/
│  └─ styles.css
├─ js/
│  ├─ config.js
│  └─ app.js
├─ www/                  # Web bundle die Capacitor in de iPhone-app laadt
│  ├─ index.html
│  ├─ css/
│  └─ js/
├─ scripts/
│  └─ build-web.mjs
├─ sql/
│  ├─ schema.sql
│  └─ migrate-admin-no-votes.sql
├─ capacitor.config.ts
├─ package.json
├─ .gitignore
└─ README.md
```

## Bestaande Supabase database bijwerken

Als je de database al had vóór de admin-update:

1. Open Supabase → SQL Editor.
2. Run `sql/migrate-admin-no-votes.sql`.

Voor een nieuwe database kun je direct `sql/schema.sql` uitvoeren.

## iPhone-app maken

Hiervoor heb je een Mac met Xcode en Node.js 22+ nodig.

Clone de repo:

```bash
git clone https://github.com/Gonebreazy2206/Zante-2027.git
cd Zante-2027
```

Installeer de dependencies:

```bash
npm install
```

Maak het native iOS-project één keer aan:

```bash
npm run ios:add
```

Open daarna Xcode:

```bash
npm run ios:open
```

Kies in Xcode bovenaan bijvoorbeeld een iPhone 17/18 simulator en druk op Run.

## Na wijzigingen aan HTML/CSS/JS

Na iedere wijziging hoef je alleen:

```bash
npm run ios:sync
npm run ios:open
```

`npm run ios:sync` kopieert automatisch de nieuwste `index.html`, `css/` en `js/` naar `www/` en synchroniseert ze daarna naar de iOS-app.

## Belangrijk

- Gebruik nooit een Supabase secret/service-role key in frontendcode.
- Alleen de Supabase publishable key staat in `js/config.js`.
- De native `ios/` map wordt aangemaakt door Capacitor op de Mac.
