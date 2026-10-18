# Rezept- und Sud-Editor — Konzept

Stand: 2026-10-16. Umgesetzt sind Rezepte (Liste, Editor, Ablage auf der SD), das Sudhaus-Modell der
Brauanlage (Etappe 1), die Wassermengen (Etappe 2a), die Aufbereitung von Hand mit High Gravity (Etappe
2b-1), die pH-Modelle (2b-2), die Automatik mit Zielprofilen (2b-3), der Maischeplan (3a), die
Effizienz-Kette (3b), die Maischprofile (3c), die Dekoktion (3d), die Versionen (4a) mit ihrem Vergleich (4b)
der Gärkeller (Gärplätze und Gebinde), das Gerüst des Suds (5a) und der Brautag: die Vorbereitung (5b-1), das
Maischen (5b-2), das Würzekochen (5b-3) und der Maischverlauf mit den Geräten des Sudhauses (5b-4), das
Maischprogramm (5b-5), der Gärung-Tab des Rezepts (5c-1, 5c-1b), der Belegungsplan mit dem Anstellen
(5c-2), das Gärprogramm mit den Stopfgaben (5c-3) und die Messungen von Hand mit dem Gärverlauf (5c-4) sowie
Reifung, Abfüllung und Bilanz (5c-5). Das UI ist
als Design-Canvas entworfen:
<https://claude.ai/artifact/7XMzdDVVShLUghHVhsSgWW> („Rezept- & Sud-Editor“, privat).

Dieses Dokument hält die **Entscheidungen und Regeln** fest, die das Design nicht von selbst zeigt.
Aussehen, Anordnung und Beispieldaten stehen im Canvas. Die Beispielwerte dort sind ausgedacht und nur
untereinander stimmig. Ausnahme ist die Aktor-Bezeichnung „Riptide Pumpe“, die aus der echten Config stammt.

## Begriffe

- **Rezept:** Bauplan eines Biers. Es hat einen Status (Entwurf/fertig) und Versionen.
- **Sud:** ein konkreter Brauvorgang nach einer bestimmten Rezeptversion. Status: Planung → aktiv → abgeschlossen.
  Aktive Phasen: Vorbereitung, Maischen, Würzekochen, Gärung, Reifung, Abfüllung.
- **Sudhaus:** der Heißbereich der Anlage, bis einschließlich Ausschlagen. Rezepte wählen ein Sudhaus-Profil.
- **Gärkeller:** der Kaltbereich, also mehrere Gärplätze und Gebinde. Der Gärplatz wird erst im Sud gewählt.
- **Zahlenfelder:** Die Einheit steht im Feld (grau, rechts, die Zahl rechtsbündig davor), nicht im Label und nicht daneben.

## Rezept

### Liste
- Spalten: Name (Stil darunter) · Volumen · Stammwürze · Alkohol · IBU · EBC · Sude · Zuletzt gebraut ·
  Aktionen (Bearbeiten, Duplizieren, Löschen).
- EBC wird als Pille in der Bierfarbe angezeigt, der Wert steht darin.
- Entwürfe tragen ein hervorgehobenes Abzeichen „Entwurf“.
- Es gibt eine Suche, aber keine Filter-Chips.
- Sortierbar nach Name, Stammwürze, Alkohol, IBU, EBC, Sude und Zuletzt gebraut (Standard).
- Ein Erstellungsdatum wird nicht angezeigt.

### Status und Versionen
- **Status:** Entwurf oder fertig. **Aus Entwürfen lassen sich keine Sude anlegen.**
- **„Als fertig markieren“** steht bei Entwürfen als Knopf neben „Speichern“.
- **Neue Version beim Ändern:** Wer ein Rezept ändert, aus dem schon Sude angelegt wurden, legt damit eine
  neue Version an. Die Kopie ist zunächst ein Entwurf. Bestehende Sude behalten ihre Version.
- **Version wechseln:** Ein Auswahlfeld im Kopf vor dem Status zeigt alle Versionen mit Datum und den Suden,
  die sie nutzen.
- **Versionen vergleichen:** Ein Dialog stellt zwei wählbare Versionen gegenüber, gruppiert nach Bereich.
  Unterschiede sind als neu, geändert oder entfernt markiert, berechnete Werte stehen dabei. Ein Schalter
  „Nur Unterschiede“ blendet gleiche Zeilen aus. Eine Funktion „vX übernehmen“ gibt es nicht
  (Entscheidung 2026-10-12): Eine ältere Version holt man über „Neue Version als Entwurf“ zurück.
- Der Abschnitt „Versionen“ steht auf der Übersicht, nicht im Tab Sude.
- **Speichern** erfolgt **explizit** über einen Knopf, der ungespeicherte Änderungen mit einem Punkt anzeigt.
  Es gibt kein automatisches Speichern.
- **„⋯“-Menü:** Duplizieren, Brauzettel drucken, Exportieren (BeerJSON, JSON), bei fertigen Rezepten
  „Neue Version als Entwurf“, Löschen.
- **Ältere Versionen** lassen sich öffnen und bearbeiten wie die neueste (Entscheidung 2026-10-10). Mit dem
  Sud gilt die Regel oben: Eine Version, aus der Sude angelegt wurden, legt beim Ändern eine neue an.
- **Stand 4a (2026-10-10, `web/src/recipes.ts`, `pages/recipe/Versions.tsx`):** Versionen ohne Vergleich.
  - **Ablage:** Jede Version ist ein Rezept mit eigener Datei `/recipes/<id>.json`, verknüpft über `rootId`
    (id der v1) und `version`. Eingebettet ins Rezept-JSON wäre die 16-KB-Grenze für Request-Bodies nach
    zwei, drei Versionen erreicht, und jedes Speichern schriebe alle Versionen mit. Rezepte ohne die Felder
    sind v1 ihrer selbst, eine Migration gibt es nicht. Die Firmware übernimmt beide Felder in den
    Listenindex (`recipeSummaryLine`), neue Routen gibt es nicht. Eine ältere Firmware ließe sie im Index
    weg, die Liste zeigte die Versionen dann als eigene Rezepte; Web-UI und Firmware kommen zusammen.
  - **Auslöser bis zum Sud:** nur „⋯ › Neue Version als Entwurf“ bei fertigen Versionen. Es kopiert die
    geöffnete Version (auch eine ältere) als nächste Nummer. Fertige Versionen bleiben bis dahin direkt
    bearbeitbar; „Zurück zu Entwurf“ bleibt.
  - **Liste:** eine Zeile je Rezept mit der neuesten Version; ab v2 trägt sie das Abzeichen „vN“. Löschen
    entfernt alle Versionen, die Rückfrage nennt ihre Zahl.
  - **Kopf:** Auswahlfeld ab zwei Versionen, je Version Nummer, Datum (letztes Speichern) und Status; die
    Sude kommen mit dem Sud. Bei ungespeicherten Änderungen fragt der Wechsel nach.
  - **„⋯“-Menü:** Neue Version als Entwurf, Duplizieren (eigenes Rezept, v1, Entwurf, „(Kopie)“),
    Exportieren (JSON, alle Versionen im Format der Rezept-Sicherung, über die Sicherungsseite wieder
    einspielbar), Diese Version löschen (ab zwei Versionen; danach öffnet die neueste verbliebene).
    Kopieren und Exportieren nehmen den gespeicherten Stand und sind bei ungespeicherten Änderungen
    gesperrt. BeerJSON und Brauzettel fehlen noch.
  - **Übersicht:** Karte „Versionen“ an der Stelle der Stil-Karte (darunter), ab zwei Versionen, neueste
    oben. Der Link „Vergleichen“ kam mit 4b.
  - **Backup:** Die Rezept-Sicherung geht über die Liste und erfasst damit jede Version.
- **Stand 4b (2026-10-12, `web/src/recipeDiff.ts`, `pages/recipe/VersionCompareDialog.tsx`):** Vergleich.
  - **Aufruf:** Link „Vergleichen“ in der Karte „Versionen“. Vorgewählt sind links der Vorgänger und rechts
    die geöffnete Version (bei v1: v1 gegen v2); beide Seiten sind frei wählbar, dieselbe Version auf
    beiden Seiten ist gesperrt. „Neu“ heißt nur rechts vorhanden, „entfernt“ nur links.
  - **Geöffnete Version:** Sie geht mit dem Stand des Editors in den Vergleich, ungespeicherte Änderungen
    eingeschlossen; ihr Eintrag im Auswahlfeld trägt dann „ungespeichert“. Die anderen Versionen lädt der
    Dialog gespeichert von der SD.
  - **Zuordnung:** Zutaten erst über die Zeilen-id (eine neue Version kopiert die ids mit), der Rest über
    Art, Katalogzutat (bei Freitext der Name) und Zeitpunkt in Listenreihenfolge. So zählt auch eine
    gelöschte und neu angelegte Gabe und jede Gabe der Wasser-Automatik als geändert. Maischschritte,
    Gärphasen und Teilschüttungen nur über die id; ein geladenes Maischprofil erscheint deshalb als
    entfernt und neu. Anzeige in der Reihenfolge der rechten Version, Entferntes an seiner alten Stelle.
    Eine umsortierte Zeile ist geändert und nennt ihre Position; eingefügte oder entfernte Zeilen
    verschieben die übrigen nicht.
  - **Geändert** ist ein Wert, wenn sein angezeigter, gerundeter Text abweicht. Bei Zahlen steht die
    Differenz dahinter. Ein Feld, das auf einer Seite nicht gilt (Nachgusstemperatur ohne Nachguss), zeigt
    dort „—“.
  - **Bereiche:** Rezept (Name, Stil, Menge mit Mengenbezug heiß/kalt, Eingabe der Effizienz-Grundlage, Sudhaus, Status,
    Beschreibung; berechnet Stammwürze, Restextrakt, Alkohol, Bittere, Farbe und die Effizienz-Kette),
    Zutaten nach Art (Menge, Zeitpunkt, Konzentration, Schüttung, sobald eine Seite mehrere hat), Wasser
    (Nachguss, Hauptguss-Verhältnis, Nachgusstemperatur, Läutern, Gaben, Verdampfung, Treberverlust,
    Ausgangswasser je Wasser mit Verschnitt, Verschnitt/High Gravity, Ziel-pH, Zielprofil mit eigenen
    Ionen; berechnet Hauptguss, Nachguss, Pfannevoll), Maischen (Teilschüttungen mit Malzmenge, Schritte
    mit Art, Temperatur, Dauer, Schüttung, Zubrühen und Dekoktion; berechnet Maischdauer), Würzekochen,
    Gärung. Jede Zutat steht einmal, im Bereich Zutaten. Ionen und pH nach der Aufbereitung zeigt der
    Vergleich nicht.
  - **Rechenwerte** beider Seiten kommen aus dem heutigen Sudhaus, der heutigen Brauerei und dem heutigen
    Katalog (dieselbe Kette wie die Übersicht). Ohne Katalog oder Sudhaus bleiben sie leer. Die Hinweise
    der Rechnungen zeigt der Dialog nicht.
  - **„Nur Unterschiede“** (beim Öffnen aus) blendet gleiche Zeilen aus, bei geänderten Einträgen auch
    deren gleiche Felder; ein Bereich ohne Unterschied sagt das.
  - **Handy:** Unter 768 px steht die Bezeichnung in einer eigenen Zeile über den beiden Werten; die
    beiden Auswahlfelder bleiben als Spaltenkopf oben stehen.

### Tabs
Übersicht · Zutaten · Wasser · Maischen · Würzekochen · Gärung · Sude (Anzahl).
Maischen und Würzekochen waren zwischenzeitlich ein Tab „Brautag“; sie sind wieder getrennt, weil jeder
Prozess-Tab jetzt seine Zutaten vollständig zeigt.
Neben den Tabs stehen kompakte Stil-Abzeichen; auf der Übersicht und im Tab Sude fehlen sie.

### Übersicht
Die Übersicht ist Steckbrief und Zusammenfassung. Prozessparameter stehen in den Tabs, nicht hier.

- **Rezept-Karte:** Glas in der berechneten Bierfarbe, Name, Beschreibung (Freitext), Sudhaus,
  Ausschlagmenge und Zielkarbonisierung in **g/l** (keine vol-Angabe).
  - **Glas:** Pint mit gerundetem Boden, Schaumkrone, dezentem Lichtreflex und aufsteigenden
    Kohlensäureblasen; bei reduzierter Bewegung stehen die Blasen still. Die Farbe soll aus dem
    berechneten EBC-Wert kommen.
- **Kennwerte als eigene kleine Karten unter der Rezept-Karte**, nicht in ihr: Stammwürze, Restextrakt,
  Alkohol, Bittere, Farbe, CO₂. Jede Karte zeigt den Stil-Status („im Stil“, „+2 über Stil“ mit
  farbigem Rand). Verworfen wurden eine Zahlenreihe in der Karte, Chips, Werte unter dem Namen und eine
  Etikett-Ansicht mit eigenem Bearbeiten-Modus.
- **Charakter:**
  - **Bittere:** BU:GU auf einer Skala mild – ausgewogen – herb
  - **Wasserprofil:** Sulfat : Chlorid auf einer Skala weich, vollmundig – ausgewogen – trocken, knackig.
    Die Wörter „malzig“ und „hopfenbetont“ sind bewusst vermieden, damit sich die Skalen nicht
    gegenseitig widersprechen.
  - **Aroma & Geschmack:** Schlagworte aus Malz, Hopfen und Hefe in einer Zeile, farbig nach Herkunft.
    Darunter eine Legende, die zugleich die Quellen nennt: Malze, Hopfensorten, Hefe.

  **Offen:** Skalengrenzen und Herleitung der Schlagworte, im Design von Hand gesetzt. Naheliegend wären
  Schlagwortlisten je Malz, Hopfensorte und Hefe in den Zutaten-Datenbanken, eventuell nach Menge
  gewichtet.
- **Brauplan:** Kacheln für Schüttung (Anteilsbalken), Hopfen (Zeitleiste der Gaben, Punktgröße = Menge),
  Wasser, Brautag (Maischkurve), Gärung (Gärkurve) und Sude. Jede Kachel führt in ihren Tab. Balken und
  Zeitleiste stehen auf gleicher Höhe, ebenso die Beschriftungen darunter.
- **Stil-Karte:** Überschrift „Stil“ auf gleicher Höhe wie „Rezept“. Sie zeigt die Stilwerte als
  Bereichsbalken mit dem Rezeptwert, dazu „x von 5 im Stil“, BU:GU, Endvergärungsgrad und CO₂-Ziel in
  g/l. Abweichungen stehen als Abzeichen direkt hinter dem Parameternamen, damit die Werte rechtsbündig
  bleiben. Mit „Ändern“ öffnet sich der Stil-Dialog; das Stilfeld im Formular gibt es nicht mehr.
- **Versionen:** Liste unter der Stil-Karte mit Link zum Vergleichsdialog (siehe oben).
- Eine Zeitleiste vom Brautag bis „trinkfertig“ wurde erwogen, aber vorerst nicht übernommen.

### Stil-Auswahl (Dialog) — *wird später noch besprochen*
- Stilrichtlinie wählbar, voreingestellt BJCP 2021.
- Suche, Filter nach Familie, Schalter „Nur passende (≥ 4 von 5)“.
- Sortiert nach Übereinstimmung mit dem Rezept. Die Detailansicht zeigt je Wert, ob er im Bereich liegt.
- Ist noch kein Stil gewählt, zeigt die Karte „Stil wählen“. Dieser Zustand ist nicht gezeichnet.
- **Datenquelle offen:** Die Stilbereiche im Design sind aus dem Gedächtnis eingetragen und nicht geprüft.
  Die offizielle Stiltabelle wird gebraucht.

### Zutaten
Der Tab Zutaten zeigt **nur die Ansicht nach Art**. Die frühere Prozess-Ansicht mit Umschalter ist aufgelöst:
ihre Gruppen stehen jetzt vollständig und editierbar in den Prozess-Tabs (siehe unten). Es gibt keinen
Kopfbereich mit Kennwerten: Stammwürze, IBU und EBC zeigen die
Stil-Badges neben den Tabs, Summen stehen in den Kartenköpfen.

**Stand (2026-10-18, `web/src/pages/recipe/IngredientCard.tsx`, `web/src/ingredientRows.ts`):** Die Tabellen sind nach der
Vorlage „Rezept · Zutaten copy“ gebaut: Überschrift über jeder Karte, Spaltenköpfe, °P vor EBC, Stopf-Tag neben dem
Zeitpunkt, Summenzeilen unter Vergärbarem und Hopfen statt im Kartenkopf. Abweichend vom Folgenden (Nutzerentscheidung):
**kg bleibt die Eingabe**, Anteil und Stammwürze werden nur angezeigt; α-Säure und Ölgehalt kommen aus Sorte bzw.
Lagerposten und sind nicht je Gabe änderbar; der Lagerteil fehlt noch. Die Farbe verteilt sich nach den Lovibond-Anteilen
(Moreys MCU sind linear in der Schüttung, nur der Exponent danach nicht), Rundungsreste aller Ergebnisspalten trägt die
größte Zeile. Vergärbares bleibt in Eingabereihenfolge (sortiert spränge die Zeile beim Tippen). Offenes: PLAN.md.

**Mengen und Anteile beim Vergärbaren**, ohne Modus-Schalter (Konzept, noch nicht umgesetzt):
- Gespeichert werden **Anteile und Stammwürze**, die kg werden daraus berechnet.
- Alle drei Felder sind direkt editierbar:
  - **kg einer Zeile** ändern: Anteile und Stammwürze werden neu berechnet, die übrigen kg bleiben.
  - **% einer Zeile** ändern: Die kg dieser Zeile folgen bei gleicher Stammwürze.
  - **Stammwürze** ändern (Fußzeile der Karte): Alle kg skalieren.
- Ändern sich Effizienz, Ausschlagmenge oder Sudhaus, bleiben Stammwürze und Anteile stehen, nur die kg
  passen sich an.
- Ergeben die Anteile nicht 100 %, wird „Summe“ in der Fußzeile gelb und bietet „auf 100 % verteilen“ an.
  Es wird **nicht** automatisch am Basismalz ausgeglichen.

**Ergebnisspalten** je Zeile, ganz rechts:
- **Vergärbares:** Beitrag zur Farbe (EBC) und zur Stammwürze (°P). Die Farbe wird im Entwurf anteilig
  nach kg × EBC verteilt. Die echte Formel (Morey) ist nicht additiv, das ist bei der Umsetzung zu klären.
  Rundungsdifferenzen in der °P-Spalte gleicht die größte Zeile aus.
- **Hopfen:** Öl der Gabe in ml und IBU. Der Ölgehalt der Sorte wird in ml/100 g angegeben.

**Spaltenordnung** in allen Karten gleich:
- Name, dann die Stammdaten der Art, dann eine Leerspalte, die den restlichen Platz aufnimmt.
- Dann Zeitpunkt · Menge · eine schmale Spalte (Anteil, Hopfen-Details bzw. leer) · zwei Ergebnisspalten.
- Die Namensspalte hat eine feste Breite. Dadurch stehen Typ, Form und Zweck bündig untereinander, ebenso
  Zeitpunkt und Menge.
- Bei den Hilfsstoffen reichen die Details über die schmale Spalte und beide Ergebnisspalten, mit Umbruch.
- **Hopfen-Details:** nur noch Kochzeit, Whirlpool-Dauer, Dip-Kontaktzeit, Stopfen-Tag und -Dauer.
  Die Whirlpool-Temperatur steht im Tab Würzekochen; die Würzemenge fürs Dip Hopping entfällt.
- **Kontinuierliche Hopfengabe** (Konzept, vorgemerkt; eigene Konzeptseite im Canvas): Zeitpunkt „Kochen ·
  kontinuierlich“ mit Details von/bis (min vor Kochende) und Intervall. Die Menge ist die Gesamtmenge, die
  Teilgaben ergeben sich daraus. IBU = Summe der einzeln gerechneten Teilgaben. Würzekochen zeigt ein Band mit
  Punkten je Teilgabe; im Sud gibt es Countdown, Fortschritt und Bestätigen/Überspringen je Teilgabe, später
  optional ein Dosierer als Aktor.

**Nach Art**, fünf Arten:
1. **Vergärbares** (Malz, Rohfrucht, Zucker, Extrakt) — nach Menge sortiert, ohne Ziehgriffe.
2. **Hopfen** — in Prozessreihenfolge. α-Säure und Öl stammen aus der Sortenliste und lassen sich **je Gabe**
   anpassen. Formen: Dolde, Pellets T90, Pellets T45, Lupulin-Konzentrat, Extrakt.
3. **Hefen & Kulturen** — Saccharomyces (ober-/untergärig, Kveik), Brettanomyces, Milchsäurebakterien,
   Mischkulturen.
4. **Aromazutaten** — Früchte, Gewürze, Kräuter, Holz, Kakao, Kaffee.
5. **Hilfsstoffe** — Wasseraufbereitung (Salze, Säuren), Klärung, Hefenahrung, Enzyme.

**Zutaten in den Prozess-Tabs.** Jeder Prozess-Tab hat eine Karte „Zutaten“ mit den Gruppen seiner
Sud-Phasen, damit jede Gruppe genau einem Sud-Tab zugeordnet ist:

| Tab | Gruppen |
|---|---|
| Maischen | Maische (Malze; Säure nach pH-Messung). Hauptguss und Nachguss mit ihrer Aufbereitung stehen nur im Tab Wasser; die Gaben in die Maische stehen in beiden Tabs. |
| Würzekochen | (Würze vor dem Kochen) · Vorderwürze · Kochen · Whirlpool / Hop Stand · (Hop Back, nur wenn das Sudhaus einen hat) · (Ausschlagwürze); die Wassermittel vor dem Kochen und in die Ausschlagwürze stehen auch im Tab Wasser |
| Gärung | Anstellen (Hefe, Dip Hopping) · Hauptgärung · Reifung (Stopfen, Schönung, zweite Kultur) · Abfüllung (Karbonisierung; Speise schreibgeschützt) |

Darstellung der Zutaten-Karte in den Prozess-Tabs:
- Dieselben Eingabe- und Ergebnisfelder wie nach Art, ohne Spalte Zeitpunkt.
- Die Art steht als Markierung in der zweiten Spalte. Es gibt keine zusätzliche Gruppierungsebene je Art.
- Die Kopfzeile des Prozessschritts trägt die Spaltenköpfe. Sie richten sich nach der ersten Zutatenart
  im Schritt; leere Schritte haben keine.
- Ganz rechts steht „+ Zutat“ in der verbreiterten Spalte des Löschen-Knopfs.
- Reihenfolge rechts: Menge · schmale Spalte (Anteil, Dauer bzw. Details) · zwei Ergebnisspalten. Die
  Details der Hilfsstoffe bleiben in der schmalen Spalte, weil in gemischten Schritten Öl/IBU darüber
  stehen können.
- **Ausnahme Maischen:** keine Art-Markierung (nur Malze und Wasser-Hilfsstoffe, die Art ist eindeutig).
  „+ Zutat“ steht als Knopf über der Karte neben dem Split-Button „+ Schüttung“, nicht in der Kopfzeile.

Fachliche Festlegungen:
- **Flameout:** keine eigene Gruppe, sondern Kochen mit 0 min.
- **Whirlpool und Hop Stand** sind eine Gruppe. Temperatur und Dauer kommen aus dem Tab Würzekochen.
- **Dip Hopping** gehört zur Gärung (Anstellen). Der Sud-Tab Würzekochen zeigt nur die abzuzweigende Würze.
- **Hochkräusen** ist ein Zeitpunkt innerhalb der Hauptgärung, keine eigene Phase.
- **Keine Begriffe Secondary/Tertiary Fermentation.** Stattdessen Reifung und Abfüllung/Karbonisierung.
- **Kettle Sour** (Milchsäurebakterien vor dem Kochen) wäre eine weitere Gruppe in Würzekochen. Vorgesehen,
  aber nicht gezeichnet.
- **Speise** ist Würze, keine Zutat.

Erlaubte Zeitpunkte je Art (der Zeitpunkt-Select bietet nur diese an):

| Art | Zeitpunkte |
|---|---|
| Vergärbares | Maische, Kochen, Gärung (Zucker/Frucht), Abfüllung (nur Zucker) |
| Hopfen | Maische, Vorderwürze, Kochen, Whirlpool, Hop Back, Dip, Hauptgärung, Reifung |
| Hefen & Kulturen | Anstellen, Reifung, Abfüllung (Abfüllhefe), Kettle Sour |
| Aromazutaten | Kochen, Whirlpool, Hauptgärung, Reifung |
| Hilfsstoffe | Brauwasser, Hauptguss, Maische, Maische nach pH-Messung, Nachguss, Würze vor dem Kochen, Kochen, Ausschlagwürze, Verschnitt, Anstellen, Reifung |

Der Auswahl-Dialog für Zutaten ist für alle fünf Arten gleich aufgebaut: Suche, Filter-Chips je Art,
Liste und Detailansicht.

### Zutaten und Lager (Menü „Zutaten“, seit 2026-10-12)
Eigener Hauptmenüpunkt `/zutaten` im Rezeptpaket. **Ein Tab je Art** (Slugs `vergaerbares`, `hopfen`,
`hefen`, `aroma`, `hilfsstoffe`): oben „Im Lager“ mit den Posten dieser Art, darunter „Katalog & eigene“ mit
Suche, Details, „Ins Lager“ und bei eigenen Zutaten Bearbeiten/Löschen. Dazu der Tab **„Lager gesamt“**
über alle Arten (Entscheidung 2026-10-12: je Art statt „Übersicht / Lager“, weil man nach Art sucht und
die Override-Felder von der Art abhängen; die Gesamtsicht kam auf Wunsch dazu).
- **Eigene Zutaten** haben das Katalog-Schema mit `owner: 'user'` und Ids `user-…` (die Id ist ein
  Dateiname, ein Doppelpunkt ginge nicht). Gespeichert auf der SD-Karte unter `/api/ingredients`.
- **Lagerposten** (`StockLot`, `/api/stock`): Menge in der Einheit der Art (Hilfsstoffe: ihre
  `defaultUnit`), Jahrgang, MHD, Notizen und **eigene Werte** (`overrides`) aus
  dem Datenblatt der Charge, z. B. das Alpha des Hopfenjahrgangs. Leere Felder behalten den Wert der Zutat.
  Gruppen wie `oilComposition` werden eine Ebene tief gemischt (`web/src/stockLots.ts`).
- **Beim Hopfen** zusätzlich Form, Lagertemperatur, Verpackung (fünf Stufen wie in J.-P. Hosoms Hop
  Freshness Calculator: Stickstoff professionell, Schutzgas selbst, vakuumiert, eingewickelt, lose) und
  „Alpha-Wert vom“ (`valuesDate`, Analyse- oder Abpackdatum). Gerechnet wird damit noch nicht; sie sind
  für die Hopfenalterung in der IBU gedacht (PLAN.md).
- **Im Rezept** bietet das Namensfeld die passenden Posten zuerst an („Lager“). Die Zeile speichert dann
  `ingredientId` der Zutat und `stockLotId`; alle Rechnungen holen ihren Eintrag über `entryOf` und nehmen
  die Werte des Postens. Ist der Posten gelöscht, rechnet die Zeile mit der Zutat weiter.
- Welche Werte Formular, Overrides und Detailansicht zeigen, steht in einer Tabelle
  (`web/src/ingredientFields.ts`); Lagerposten überschreiben nur Messwerte, nicht Art oder Kategorie.
- Abbuchen beim Brauen kommt mit dem Sud (PLAN.md).

#### Entwurf Rohstoffverwaltung (Canvas, 2026-10-13)
Frei neu entworfen im Design-Canvas (Reihe „Zutaten & Lager“), **noch nicht umgesetzt** und im Detail noch
nicht mit dem Nutzer durchgesprochen. Der Entwurf weicht vom gebauten Stand oben ab und ergänzt vier
Funktionen: Buchungen mit Verlauf, Abgleich mit Rezept und Sud, Meldebestand mit Einkaufsliste, Preise und
Kosten. Es bleibt bei **einem Lager** ohne Lagerorte (Entscheidung 2026-10-12).

Aufbau: Menüpunkt „Zutaten“, eine Seite mit vier Tabs statt eines Tabs je Art.

| Tab | Inhalt |
|---|---|
| Lager | Kennzahlen (Lagerwert, fehlt für geplante Sude, unter Meldebestand, Haltbarkeit). Eine Tabelle über alle Arten, nach Art gruppiert, mit Suche und Filtern (Art; fehlt, knapp, läuft ab, reserviert). Zeile je Zutat mit Bestand gegen Meldebestand, reserviert, verfügbar, haltbar bis, Wert; aufklappbar auf die Posten. |
| Katalog | Katalog und eigene Zutaten, Liste links, Details rechts. Je Zutat die Lagerhaltung: Meldebestand, übliches Gebinde, Lieferant, letzter Preis. „Ins Lager“, „Eigene Zutat“, „Als eigene Zutat kopieren“. |
| Einkauf | Einkaufsliste, gruppiert nach Lieferant oder Anlass, mit Bestellmenge, Gebinde, letztem Preis und Summe. Abhaken führt zu „Zugang buchen“. |
| Buchungen | Journal, je Vorgang (Lieferung, Sud, Inventur, Abgang) aufklappbar auf die einzelnen Buchungen mit Menge, Bestand danach und Wert. |

Dialoge: **Lagerposten** (Daten des Postens, Einkauf, eigene Werte, rechts der Bestandsverlauf mit
Reservierung) und **Buchen** (Umschalter Zugang · Abgang · Inventur, jeweils mit „Bestand danach“).

Vorschläge, die der Entwurf zeigt:
- **Bestand ändert sich nur über Buchungen.** Die Menge am Posten ist kein Eingabefeld mehr; eine
  abweichende Zählung ist eine Inventur, gebucht wird die Differenz als Korrektur. Buchungen sind nicht
  änderbar, Fehler werden gegengebucht.
- **Zugang** legt einen neuen Posten an (eigene Charge, eigene Werte) oder erhöht einen bestehenden.
  Der Preis steht am Posten; aus Preis gesamt und Menge ergibt sich der Preis je Einheit.
- **Reserviert** sind die Mengen geplanter Sude. Verfügbar = Bestand − reserviert; wird das negativ, fehlt
  die Zutat. Vorgeschlagen wird je Zutat der Posten, der zuerst abläuft; eine Gabe kann sich so auf zwei
  Posten verteilen.
- **Abbuchen** je Gabe beim Bestätigen im Sud, mit der Ist-Menge. **Abweichung vom gebauten Stand:** Sud 5a
  bucht beim Start des Suds die Rezeptmenge ab. Welcher Weg bleibt, ist offen.
- **Meldebestand** gilt je Zutat, nicht je Posten. Die Einkaufsliste schlägt vor, was geplanten Suden
  fehlt, plus das Auffüllen bis zum Meldebestand, aufgerundet auf das übliche Gebinde; abgelaufene Posten
  zählen dabei nicht als Bestand.
- **Kosten:** Das Rezept rechnet mit dem letzten Einkaufspreis je Zutat (Übersicht: Karte „Lager &
  Kosten“ mit Summe, Preis je Liter und Aufteilung nach Art). Der Sud rechnet mit den Preisen der gewählten
  Posten. Zutaten ohne Preis werden gezählt, nicht geschätzt.
- **Im Rezept** zeigt jede Zutatenzeile den Bestand der Zutat (Punkt und Menge, rot bei Fehlmenge), darüber
  eine Zeile mit Fehlmengen, Kosten und Link zur Einkaufsliste. **Im Sud** (Vorbereitung) steht je Zutat
  der gewählte Posten.

Offen: alle Details der Seiten (Durchsicht steht aus), ob Tabs je Art oder die eine Tabelle, Umgang mit
angebrochenen Gebinden und Einheiten (Hefe in Päckchen), Reservierung über mehrere geplante Sude,
Lieferanten als eigene Liste oder Freitext, Mobile.

### Wasser
- **Stand:** Wassermengen seit Etappe 2a (2026-10-06, `web/src/recipeWater.ts`), Aufbereitung von Hand und
  High Gravity seit Etappe 2b-1 (2026-10-07, `web/src/waterChem.ts`, `web/src/recipeTreatment.ts`), pH von
  Maische und Würze seit Etappe 2b-2 (2026-10-07, `web/src/mashPh.ts`), Zielprofile und Automatik seit
  Etappe 2b-3 (2026-10-07, `web/src/waterSolver.ts`).
- **Säure für die Maische** wird nach dem Einmaischen und der pH-Messung gegeben, nicht in den Hauptguss.
  Der Sud schlägt die Menge aus dem gemessenen pH neu vor (später).
- **Salze und Säuren** sind dieselben Einträge wie unter Zutaten › Hilfsstoffe und lassen sich **an beiden
  Stellen bearbeiten**. Feste Mittel werden in g dosiert, Säuren und Lösungen in ml mit einer Konzentration
  je Gabe (Vorgabe aus dem Katalog).

**Aufbereitung** (Karte unter der Wassermenge):
- **Spalten:** Hauptguss · Maische · Nachguss · Vor dem Kochen · Ausschlag · Verschnitt · Gesamt. Nachguss
  entfällt bei Vollguss, Verschnitt ohne geplante Menge, die beiden Würzespalten ohne Gabe dort. Auf dem Handy
  sind die Spalten Reiter.
- **Zeitpunkt je Gabe** statt Schalter: „Brauwasser“ verteilt sich nach Einfüllmenge auf Haupt- und
  Nachguss, beide bekommen also dieselbe Konzentration. Gezielt gehen Hauptguss, Maische, Maische nach
  pH-Messung, Nachguss, Würze vor dem Kochen, Ausschlagwürze und Verschnitt. „Maische nach pH-Messung“ ist
  die Korrekturgabe nach dem Einmaischen; sie zählt in die Maische-Spalte, der geschätzte pH steht vor und
  nach ihr. Gaben in die Würze steuern den pH beim Kochen (Maillard) oder in der Ausschlagwürze (etwa höher
  für Kveik, gegen den pH-Abfall); Zeitpunkt „Kochen“ bleibt für Irish Moss und Ähnliches. Die Spalten zeigen, was von jeder Gabe dort ankommt; der Anteil einer
  Brauwasser-Gabe ist ausgegraut. Bearbeitet wird die Gabe in ihrer Zeile (Name, Zeitpunkt, Menge,
  Konzentration). „+ Salz/Säure“ legt eine Zeile an, die Suche bietet nur Wassermittel an.
- **Volumenbasis** sind die Einfüllmengen, weil die Salze ins HLT gehen; die Maische rechnet mit dem
  Hauptguss, der ankommt, und startet vom aufbereiteten Hauptguss. Die Würze vor dem Kochen (Pfannevoll)
  trägt Maische und Nachguss nach Volumen gemischt; das Kochen konzentriert sie auf die Ausschlagmenge, ein
  Verschnitt in der Pfanne ist darin enthalten. **Gesamt** ist der Beitrag von Wasser und Gaben zum Bier,
  mit einem Verschnitt im Gärbehälter. Ionen aus dem Malz und was beim Maischen und Kochen ausfällt (vor
  allem Calcium) fehlen.
- **Ausgangswasser** je Wasser: ein Profil der Brauerei, ohne Wahl das Standardwasser, dazu „+ x %“ eines
  Zweitwassers (Vorgabe VE-Wasser). Ionen, Alkalität und Carbonat mischen sich nach Volumen.
- **Ergebnis** je Spalte: Ca, Mg, Na, Cl, SO₄, HCO₃ in mg/l, Restalkalität in °dH, SO₄ : Cl und der pH. In den
  Wasserspalten ist das der pH nach Säure (nur wenn das Profil einen pH hat), in Maische, Würzespalten und
  Gesamt die Schätzung des pH-Modells („≈“). In den Würzespalten und Gesamt stehen keine Alkalität und RA,
  weil sie dort nicht mehr dem Wassermodell folgen. In Klammern steht der Wert vor den Gaben, beim pH der
  Maische der Wert vor der Gabe nach pH-Messung.
- **Säurehilfe** je Wasserspalte: Ziel-pH, dann „Säure berechnen“. Das setzt die Menge der ersten Säure, die
  gezielt in diese Spalte geht, oder legt Milchsäure an.
- **Säure- und Basenhilfe** für Maische, Würze vor dem Kochen und Ausschlagwürze (nur mit pH-Schätzung):
  Ziel-pH (Maische ohne Eingabe 5,4), dann „Säure/Base berechnen“. Liegt der pH ohne die Säuren und Basen der
  Spalte über dem Ziel, setzt sie die erste Säure der Spalte oder legt Milchsäure an, sonst die erste Base
  oder Natron (für Kveik). In der Maische nimmt sie nur Gaben „Maische nach pH-Messung“ und legt auch dort an.
- **pH-Schätzung**, Modell auf Brauerei-Ebene (Anlage), der Tab nennt es in der pH-Zeile:
  - **Troester** (Vorgabe; Troester 2009, „The effect of brewing water and grist composition on the pH of the
    mash“, braukaiser.com): Die Schüttung hat in destilliertem Wasser den pH Σ pHb·gb + 5,7·Σ gs −
    0,14·Σ(as·gs)/R, Basismalze nach ihrem pH, Spezialmalze nach ihrer Säure (mEq/kg bis pH 5,7), R = Hauptguss
    je kg Schüttung. Das Wasser verschiebt ihn um s·RA mit s = 0,013·R + 0,013. Säure, die über die
    Alkalität des Wassers hinausgeht, wirkt auf die **Pufferung der Schüttung**: 38,5 mEq/(kg·pH) aus Troesters
    Maische-Titration (0,104 pH·l/mEq bei 4 l/kg), die Literatur nennt etwa 40 (deLange). Entscheidung
    2026-10-07: Rein linear über die RA rechnet Troesters eigene Salzsäure-Reihe (Tabelle 3, Pilsner) bis
    0,2 zu hoch und die Säurehilfe schlägt deutlich zu viel Säure vor; mit der Pufferung trifft sie auf
    ± 0,04. Dunklere Schüttungen reagieren schwächer auf viel Säure, als die Pufferung sagt (Tabelle 3, bis
    −0,18 bei −5,6 mEq/l); die Hilfe schlägt dann zu wenig vor, nach der Messung lässt sich nachsäuern.
    Sauermalz zählt nach Troesters Malzformel und wirkt dort etwa 1,5-mal stärker als dieselbe Milchsäure
    flüssig, das steht als Hinweis da. Genauigkeit der Maische etwa ± 0,1–0,2.
  - **Malzdaten** am Katalog-Malz: `distilledWaterPh`, `acidityMeqPerKg`, `lacticAcidPct` (Sauermalz,
    Milchsäure-% × 10 000 / 90,08). Ohne sie nach Rolle und Farbe, mit Hinweis: Basismalz 5,82 − 0,02·EBC
    (Troester, R² 0,54), Karamellmalz 14 + 0,13·EBC mEq/kg, Röstmalz 40 mEq/kg, Spezialmalz bis 25 EBC wie
    Basismalz, darüber wie Karamellmalz (Entscheidung 2026-10-07; die Basismalz-Gerade stützt sich auf Malze
    bis 25 EBC, Troesters Biscuit hatte 20,2 mEq/kg, die Karamell-Gerade gibt 21,8), Rohfrucht wie Basismalz.
    Malze ohne Katalogverknüpfung bleiben außen vor; ohne verknüpftes Malz gibt es nur Hinweise. Die
    Weyermann-Datenblätter im Katalog nennen keine dieser Werte.
  - **Würze**, grobe Schätzung: Sie startet beim Maische-pH nach allen Gaben und behält die Pufferung je kg
    Schüttung (Mischen und Einkochen ändern Säure und Puffer gleich). Nachguss, Verschnitt und Gaben wirken
    mit ihrer Restalkalität × Menge, Hydrogencarbonat voll, weil das CO₂ beim Kochen entweicht. Das Kochen
    senkt um 0,15 (Troester, braukaiser.com, „How pH affects brewing“: 0,1–0,2). Ob Troesters
    Maische-Pufferung so auf die Würze übertragbar ist, ist nicht belegt (TODO(verify)).
  - **Kolbach:** nur die Restalkalität, ohne pH-Zahl, wie man klassisch mit RA arbeitet. Die Maische-Spalte
    zeigt den Zielbereich nach Bierfarbe von Palmer (How to Brew): RA in ppm CaCO₃ von 12,2·SRM − 122,4
    (Farbe aus Basis- und Karamellmalz) bis 12,2·(SRM − 5,2) (Farbe aus Röstmalz); TODO(verify), aus einem
    Forenzitat des Buchs. Säure- und Basenhilfe gibt es dann nur für die Wasserspalten.
  - Säuren zählen in RA und Schätzung weiter mit ihrem Anteil bei pH 5,4. Mit dem geschätzten Maische-pH
    statt 5,4 änderte sich der Anteil zwischen pH 5,2 und 5,8 um höchstens etwa 2 % (Milch- und
    Phosphorsäure), bei 8 ml Milchsäure weniger als 0,01 pH; deshalb bleibt es.
- **Modelle und Quellen:** Restalkalität = Alkalität − Ca/3,5 − Mg/7 in mEq/l (Troester 2009; 1 mEq/l =
  2,8 °dH). Säuren zählen dabei mit dem Anteil, den sie bei pH 5,4 abgeben (Henderson-Hasselbalch;
  Milchsäure pKa 3,86, Phosphorsäure 2,15/7,20/12,35, Schwefelsäure 2 Protonen), Kreide nur zur Hälfte
  (Troester). HCO₃ = Alkalität × 61,02. Der pH nach Säure folgt aus dem Kalk-Kohlensäure-Gleichgewicht bei
  25 °C (Carbonat aus Ausgangs-pH und Alkalität, Ladungsbilanz per Bisektion); Ionenstärke und entweichendes
  CO₂ bleiben außen vor. Mittel nach MMuM: CaSO₄·2H₂O, CaCl₂·2H₂O, CaCl₂-Lösung, MgSO₄·7H₂O, MgCl₂·6H₂O,
  NaCl, NaHCO₃, CaCO₃, Ca(OH)₂, Milch-, Phosphor-, Salz- und Schwefelsäure. Dichten: Milchsäure 80 % =
  1,206 g/ml (MMuM), sonst CRC-Tabelle (20 °C), noch nicht gegen die Tabelle geprüft.
- **Hinweise:** Gaben ohne Wassermittel aus dem Katalog, Gaben in einen Nachguss oder Verschnitt, den es
  nicht gibt, fehlendes oder gelöschtes Wasserprofil (gerechnet wird dann mit VE-Wasser).
- **Ziel** (seit 2b-3): Der Knopf „Ziel“ blendet eine Spalte am Ende ein, die den **Hauptguss** mit einem
  Zielprofil vergleicht, auch ohne Automatik. Das Ziel steht im Rezept (`RecipeWater.target`): ein
  mitgeliefertes oder eigenes Zielprofil der Brauerei, oder „Eigene Werte“, die sich direkt in der Spalte
  eingeben lassen. Je Ion stehen der Zielwert und in Klammern die Abweichung des Hauptgusses, hervorgehoben
  ab 20 % bzw. 10 mg/l. HCO₃, Restalkalität und SO₄ : Cl des Ziels dienen nur zur Information, denn die
  Alkalität regelt die Säure über den Ziel-pH der Maische. Verglichen wird der Hauptguss, weil Zielprofile
  Wasserprofile sind; „Gesamt“ enthält Konzentrierung, Würzegaben und Verschnitt, aber keine Malz-Ionen.
- **Mitgelieferte Zielprofile** (mg/l, Ca/Mg/Na/Cl/SO₄/HCO₃), aus der Zusammenfassung der Zielprofile von
  Brewer's Friend (brewersfriend.com/brewing-water-target-profiles), Wien aus Palmer, How to Brew, Tab. 21
  (dort fehlt es bei Brewer's Friend). Dortmund und Burton in der entcarbonisierten Fassung, mit der dort
  tatsächlich gebraut wurde (Entscheidung 2026-10-07):

  | Profil | Ca | Mg | Na | Cl | SO₄ | HCO₃ | Quelle |
  |---|---|---|---|---|---|---|---|
  | Ausgewogen | 80 | 5 | 25 | 75 | 80 | 100 | BF Balanced Profile (goldgelb bis bernstein) |
  | Hell, malzig | 60 | 5 | 10 | 95 | 55 | 0 | BF Light colored and malty |
  | Hell, hopfig | 75 | 5 | 10 | 50 | 150 | 0 | BF Light colored and hoppy |
  | Pilsen | 7 | 3 | 2 | 5 | 5 | 25 | BF |
  | Dortmund | 155 | 23 | 10 | 100 | 300 | 53 | BF, entcarbonisiert (nach Kolbach 1953) |
  | München | 82 | 20 | 4 | 2 | 16 | 320 | BF, Wasserbericht 2013 (Dunkel, Bock) |
  | Wien | 200 | 60 | 8 | 12 | 125 | 120 | Palmer, How to Brew, Tab. 21 |
  | Düsseldorf | 90 | 12 | 45 | 82 | 65 | 223 | BF, Wasserbericht 2013 (Alt) |
  | Burton | 187 | 41 | 113 | 85 | 720 | 20 | BF, entcarbonisiert |
  | London | 100 | 5 | 35 | 60 | 50 | 265 | BF |
  | Dublin | 110 | 4 | 12 | 19 | 53 | 280 | BF |
  | Edinburgh | 100 | 18 | 20 | 45 | 105 | 235 | BF |

  Eigene Zielprofile legt man unter Profile › Zielwasser an (bis 2026-10-18 in Anlage › Wasserprofile mit dem
  Haken „Zielprofil“).
- **Automatisch** (Dialog, seit 2b-3): Zielprofil (oder eigene Werte), erlaubte Salze, eine Säure, Anteil des
  Zweitwassers (meist VE) frei oder fest, Ziel-pH der Maische. Der Löser sucht den Anteil von 0 bis 100 % in
  1-%-Schritten. Je Anteil passt er die Salze per NNLS (Lawson-Hanson) auf Ca, Mg, Na, Cl und SO₄ des
  Hauptgusses an, gewichtet in mEq/l. Der beste Anteil gewinnt; ist das Ziel über einen Bereich erreichbar,
  der kleinste. Danach stellt die Säure die Maische auf den Ziel-pH, unter Kolbach die Restalkalität der
  Maische auf die Mitte des Zielbereichs nach Bierfarbe. Bewusst ohne HCO₃ in der Anpassung und ohne
  Basen (Entscheidung 2026-10-07): Sonst gäbe die Anpassung Natron für ein alkalisches Ziel, das die Säure
  für den Ziel-pH gleich wieder neutralisiert, oder sie triebe den VE-Anteil hoch, wo die Säure das HCO₃
  ohnehin wegnimmt. Liegt die Maische schon ohne Säure darunter, gibt es einen Hinweis auf die Basenhilfe.
  Angeboten werden nur neutrale Salze (Gips, Calciumchlorid fest und als Lösung, Bittersalz,
  Magnesiumchlorid, Kochsalz).
  - Die Vorschau zeigt Ziel, jetzt und Vorschlag für den Hauptguss und den Maische-pH (bzw. die RA), dazu
    die Gaben: neue, entfallende (aus einem früheren Lauf) und bleibende (von Hand, auch in Würze und
    Verschnitt; die fasst die Automatik nicht an).
  - Erst „Übernehmen“ schreibt: Salze mit Zeitpunkt „Brauwasser“, die Säure „Maische nach pH-Messung“,
    denselben Anteil in Haupt- und Nachguss (`sources.strike/sparge.blendPct`) und das Ziel. Die Gaben
    tragen `auto: true`; ein erneuter Lauf ersetzt sie, wer eine von Hand ändert, nimmt ihr die Markierung.
  - Beispiel mit dem Leitungswasser des Nutzers (Pils, 5 kg, 20 l): Pilsen 93 % VE, „Hell, hopfig“ 98 %
    (Gips für 150 mg/l SO₄ bringt schon 63 mg/l Ca), „Ausgewogen“ 55 %, München 37 % (nur VE senkt das
    Chlorid).
- Die Übersicht zeigt SO₄ : Cl des Hauptgusses auf der Skala weich, vollmundig – ausgewogen – trocken,
  knackig (Grenzen 0,8 und 1,5, wie gängige Rechner; noch ohne Primärquelle).

**Verschnitt (High Gravity)** gehört ins Rezept, als Abschnitt der Karte „Wassermenge“:
- **Ort** je Rezept: Pfanne bei Kochende, Gärbehälter oder Keg beim Abfüllen (seit 2026-10-18). **Menge und Stammwürze** hängen voneinander ab;
  was zuletzt geändert wurde, führt, das andere wird berechnet. Ein Ortswechsel behält die Menge.
- **Pfanne:** Ausschlagmenge und Stammwürze des Rezepts gelten nach dem Verschnitt. Die Pfanne kocht
  Ausschlag − Verschnitt bei entsprechend höherer Stammwürze; die Rückrechnung der Wassermengen beginnt
  dort. Passt Pfannevoll nicht in den Kochbehälter, nennt ein Hinweis den Verschnitt, mit dem es passt
  („übernehmen“).
- **Gärbehälter:** Der Ausschlag bleibt unverdünnt. Im Gärbehälter kommt Ausschlag − Kühlschwund − Totraum
  der Pfanne − Transferverluste ab Whirlpool an (ohne Sudhaus der ganze Ausschlag, mit Hinweis), dazu der
  Verschnitt. Die Stammwürze folgt aus der Massenbilanz. Hopfenaufnahme und Trub kommen mit dem Gärung-Tab.
- **Keg beim Abfüllen** (2026-10-18, Nutzer): Bis zum Gärbehälter rechnet alles wie ohne Verschnitt, vergoren
  wird die starke Würze; beim Abfüllen kommt entgastes, keimfreies Wasser zum ganzen Bier (nicht nur zu den
  Kegs). Bier vor dem Verschnitt = Anstellwürze − Trub − Stopfhopfen; Stammwürze nach Verschnitt aus der
  Massenbilanz wie beim Gärbehälter, Faktor = Bier / (Bier + Verschnitt). `pitchPlato` liefert die
  Anstell-Stammwürze (beim Keg die vor dem Verschnitt). Speise wird nicht abgezweigt.
  - **Kennwerte** zeigen das Bier nach dem Verschnitt (auch für den Stilvergleich): Stammwürze und Restextrakt
    rechnerisch, Farbe und Bittere × Faktor, **Alkohol** = Balling der vergorenen Würze × Faktor (Verdünnung nach
    Volumen, so rechnet auch der Sud).
  - **Karbonisierung:** Zucker und Zwangskarbonisierung rechnen fürs verdünnte Bier; Speise und Grünschlauchen
    passen nicht (Hinweis, keine Zahl).
  - **Aufbereitung:** Die Spalte Verschnitt wirkt wie beim Gärbehälter nur in „Gesamt“ (Bier nach Verschnitt).
  - **Effizienzen** bleiben unverändert: Wasser bringt keinen Extrakt, Soll und Ist der Gesamteffizienz rechnen
    mit Anstellwürze und Anstell-Stammwürze vor dem Verschnitt.
  - **Abfüllmenge:** + Verschnitt im Keg nach Jungbier und Speise.
  - **Sud › Abfüllung:** Messwert `dilutionVolume` (Verschnitt, Soll aus dem Rezept), Bilanz-Zeile „Verschnitt im
    Keg“; Bier zum Abfüllen und Zucker mit der gemessenen Menge; Alkohol × Bier / (Bier + Verschnitt). Stammwürze
    und Restextrakt bleiben die gemessenen des vergorenen Biers.
- **Kennwerte:** Stammwürze ist die nach dem Verschnitt. Die Bittere rechnet Tinseth mit Menge und
  Stammwürze der Pfanne und verdünnt das Ergebnis; beim Gärbehälter und Keg verdünnt sich auch die Farbe.
- Der Balken der Wassermenge bekommt das Segment Verschnitt.

**Wassermenge:**
- Das Rezept wählt sein **Sudhaus** in der Übersicht. Ohne Sudhaus, oder wenn das gewählte gelöscht ist,
  rechnet der Tab nicht und sagt das.
- **Ausschlagmenge** ist die Würze heiß im Kessel am Kochende, der klassische Bezug der Sudhausausbeute. Was
  danach verloren geht (Totraum der Pfanne, Hopfenaufnahme, Whirlpool, Hop Back, Kühler, Transfers ab
  Whirlpool, Kühlschwund), rechnet die Abfüllmenge in der Gärung vorwärts.
  - **Stammwürze kalt** (seit 3b): Der Extrakt der heißen Ausschlagmenge steht in deren Volumen nach dem
    Abkühlen, Ausschlag × (1 − Abkühlschwund des Sudhauses); vorher wurde er auf die heiße Menge gerechnet
    und die Stammwürze lag um den Schwund zu niedrig (5 kg Pils, 75 %: 13,6 statt 14,1 °P). Ohne Sudhaus
    bleibt es beim Ausschlag. Dasselbe gilt für Pfannen-Stammwürze und Verschnitt in der Pfanne.
  - **Heiß/Kalt-Schalter (Stand 5c-1b, 2026-10-14, `recipeStats.knockOutL`, `pages/recipe/tabs.tsx`):**
    `volumeBasis` am Rezept, ohne Angabe heiß. Bei „kalt“ ist die Rezeptmenge die Anstellwürze im
    Gärbehälter (wie Brewfathers „Batch size“).
    - **Rückrechnung:** Der Ausschlag steckt überall in der Kette: Stammwürze, Speise, Verschnitt nach °P,
      Grundlage Brewhouse-Efficiency und Läutereffizienz. `knockOutL` kehrt die Kette deshalb nicht
      geschlossen um, sondern sucht den Ausschlag, dessen Vorwärtsrechnung (`wortExtract` →
      `resolveDilution` → `pitchL`) die Anstellwürze ergibt (Regula falsi, Illinois). Hin- und
      Rückrechnung stimmen damit überein.
    - **Leser:** Alle Rechnungen lesen den Ausschlag über `knockOutL`. Die Tabs, der Versionsvergleich
      und der Sud (`brewTargets`) rechnen mit einer Kopie aus `atKnockOut`, gespeichert wird immer das
      Original. Die Kettenfunktionen selbst lesen `volumeL` dieser Kopie, sie sind ja das, was gelöst wird.
    - **Umschalten** rechnet die Menge um (auf 0,1 l gerundet), das Bier bleibt gleich (Nutzer). Bei
      „kalt“ steht unter dem Feld der Ausschlag.
    - **Nicht erreichbar** ist eine Anstellwürze, wenn der Verschnitt im Gärbehälter schon mehr ist. Dann
      gibt es einen Hinweis, und gerechnet wird mit dem nächsten Ausschlag (Nutzer). Ein Verschnitt im
      Gärbehälter nach °P legt mit der Schüttung die Anstellwürze schon fast fest; der Ausschlag kann dann
      sehr klein werden.
    - **Rezeptliste:** Sie zeigt die Rezeptmenge ohne Bezug, weil die Summary der Firmware kein
      `volumeBasis` hat (offen, PLAN.md).
- **Wassermenge** wird **vom Ausschlag zurückgerechnet**, nicht vom Wasser vorwärts:
  1. Verdampfung = l/h × Kochdauer aus dem Würzekochen. Ausschlag + Verdampfung = **Pfannevoll**.
  2. **Würzeverluste vor dem Kochen** aus den Transfers der Schritte Maischen und Läutern: der
     Leitungsverlust, wenn eine Pumpe fördert und er nicht zurückkommt, und der Totraum des
     Quellbehälters, wenn er per Pumpe oder Schwerkraft leerläuft. „Von Hand“ (Schöpfen, Sack heben)
     hinterlässt keinen Totraum. Ein Topf ohne Transfer hat keine Würzeverluste.
  3. **Treber** = Schüttung (Vergärbares im Zeitpunkt Maische) × Treberverlust (l/kg).
  4. Pfannevoll + Würzeverluste + Treber = **Gesamtwasser**, das Wasser in Maische und Läuterbottich.
  5. **Mit Nachguss:** Hauptguss = Hauptguss-Verhältnis (Vorgabe 3,5 l/kg) × Schüttung, Nachguss = Rest.
     **Ohne Nachguss** (Vollguss) ist der Hauptguss das gesamte Wasser, das Verhältnis wird zum Ergebnis.
     Hat das Sudhaus keinen Schritt Nachguss, ist der Schalter gesperrt.
  6. **Einfüllmenge je Guss:** Kommt ein Guss per Transfer, braucht er zusätzlich den Leitungsverlust (wenn
     er nicht zurückkommt) und einmal je Quellbehälter dessen Totraum, beim ersten Guss daraus. Liegt der
     Guss im Maischbehälter selbst, ist die Einfüllmenge gleich dem Guss.
- **Hinweise** sperren nichts: kein oder gelöschtes Sudhaus, Kochbehälter ohne Verdampfung, keine
  Schüttung, Nachguss unter 0 (Verhältnis zu hoch), Pfannevoll größer als der Kochbehälter, Maische
  (Hauptguss + 0,75 l/kg Verdrängung, Wert aus dem Braumagazin) größer als der Maischbehälter.
- **Darstellung:** Karte „Wassermenge“ mit Kennzahlen (Hauptguss, Nachguss, Gesamtwasser, Pfannevoll; darunter
  „einfüllen x l“, wenn die Einfüllmenge abweicht; seit 3b die Läutereffizienz mit Verfahren), Schalter
  „Mit Nachguss“, Eingaben (Hauptguss-Verhältnis, Nachguss-Temperatur, mit Nachguss das Läutern als Batch
  oder Fly Sparge und bei Batch die Zahl der Gaben, Verdampfung, Treberverlust) und farbigem Balken (Gesamtwasser aufgeteilt in
  Ausschlag, Verdampfung, Treber, Totraum/Transfer). Die Rechnung steht mit Herkunft jeder Zahl (Rezept
  bzw. Sudhaus) in einer Akkordeon-Leiste „Berechnung“ (Tabelle mit Vorgabe, Volumen, Grundlage; Zwischensummen hervorgehoben), standardmäßig zu. Überschrift der Karte steht seit 2026-10-17 außerhalb, wie im Mockup (ebenso bei der Abfüllmenge).
- Toträume, Transferverluste, Verdampfung und Treberverlust kommen als Vorgabe aus dem Sudhaus.
  **Verdampfung und Treberverlust** lassen sich pro Rezept überschreiben; der Platzhalter zeigt den
  Sudhaus-Wert, „Sudhaus-Wert“ nimmt die Überschreibung zurück.

### Maischen und Würzekochen
- **Maischen** (Tab): Kopfkarte, Zutaten (Maische), Maischeplan, Temperaturverlauf.
  - Konversion (Vorgabe aus dem Sudhaus, siehe Effizienz)
  - Maischeplan aus Schritten, aus Vorlagen oder frei; die Reihenfolge lässt sich per Ziehgriff ändern.
    Die erste Spalte legt die **Art des Schritts** fest:
    - **Wasser vorlegen:** Hauptguss auf Temperatur bringen. Menge und Temperatur sind nur lesbar: Die
      Menge ist der Hauptguss minus alle Zubrühmengen, die Temperatur ergibt sich aus der Vorgabe des
      folgenden Einmaischens und der Malztemperatur. Keine Dauer, nur die Heizzeit als Übergang.
    - **Einmaischen:** eine Schüttung zugeben (nur Malz, kein Wasser). Folgt es auf Wasser vorlegen, ist die
      Temperatur die Vorgabe; bei jeder weiteren Schüttung ist sie das Ergebnis (Mischtemperatur aus
      Maische und Malztemperatur) und nur lesbar.
    - **Rast:** Temperatur durch Heizen oder passives Abkühlen erreichen (Dauer des Abkühlens nur
      geschätzt, am Brautag bestätigt). Aktiv gekühlt wird nur durch Zubrühen, das Sudhaus hat dafür kein
      Gerät.
    - **Zubrühen (Infusion):** Wasser zugeben, heiß oder kalt, oder Eis zum Kühlen (mit Schmelzwärme).
      Menge und Temperatur hängen voneinander ab; was zuletzt geändert wurde, führt (wie Menge/Anteil bei
      den Zutaten): eine feste Menge ergibt die nötige Wassertemperatur, eine feste Temperatur (z. B.
      kochend) die nötige Menge. Die Wassertemperatur liegt zwischen Leitungswasser (Brauerei-Ebene) und
      Siedepunkt; liegt die Lösung außerhalb, gibt es einen Hinweis.
    - **Dekoktion:** einen Teil der Maische (dick oder dünn) im Dekoktionsbehälter rasten lassen, kochen
      und zurückführen. Anteil und Zieltemperatur hängen voneinander ab; was zuletzt geändert wurde,
      führt. Die Restmaische ruht derweil. Details unter „Stand 3d“.
    - **Kochen im Maischbehälter** (Earls Kochmaische): eine Rast am Siedepunkt, nur bei direkt beheiztem
      Maischbehälter.
    - Strike entspricht dem Einmaischen, Sparge (Fly/Batch) gehört zum Läutern, nicht in den Maischeplan.
      Steeping (Malz einhängen und wieder herausnehmen) ist vor allem beim Extraktbrauen üblich und vorerst
      nicht vorgesehen.
  - Spalten des Plans: Schritt · Bezeichnung · Zugabe (Hauptguss, Schüttung bzw. Wassermenge und
    -temperatur) · Temperatur · Dauer · Übergang (Heizen, Abkühlen, Mischen) · Beginn. Beginn ist der
    Zeitpunkt, an dem die Temperatur des Schritts erreicht ist; die Zeit zählt ab dem Aufheizen des
    Hauptgusses. Unter der Bezeichnung stehen keine Erläuterungen.
  - **Wasser im Maischeplan = Hauptguss** aus dem Tab Wasser (Wasser vorlegen plus alle Zubrühmengen).
  - **Teilschüttungen:** Die Malze der Gruppe Maische lassen sich auf mehrere Schüttungen verteilen,
    z. B. beim Weizen die zweite Hälfte nach dem Abkühlen. Keine eigene Spalte: Bei mehr als einer
    Schüttung stehen die Schüttungen in der Zutaten-Karte untereinander, jede mit Zwischenzeile (Name,
    Zeitpunkt im Plan, Summen für Menge, Anteil, EBC, °P). Bei nur einer Schüttung entfällt die
    Zwischenzeile.
  - Split-Button „+ Schüttung“ über der Zutaten-Karte: links eine leere Schüttung anlegen, der Pfeil
    öffnet „Schüttung aufteilen“ (Schüttung wählen, Anteil in %, Vorschau je Malz, Stelle im Plan). Jede
    neue Schüttung legt im Plan einen Schritt Einmaischen an.
  - **Maischprofile** (ganze Rastfolgen) lassen sich über „Profil ▾“ laden und ersetzen dann den Plan; der
    aktuelle Plan lässt sich als Profil speichern. Profile werden **global** gespeichert, nicht je Rezept
    oder Sudhaus.
  - Split-Buttons: „+ Rast hinzufügen“ fügt eine freie Rast an, der Pfeil daneben bietet die übrigen
    Schritt-Arten (Zubrühen, Einmaischen, Dekoktion) und vordefinierte Rasten.
    „Profile“ öffnet den Dialog Maischprofile, der Pfeil daneben lädt ein Profil direkt.
  - **Dialog Maischprofile:** Liste (eigene und mitgelieferte) und Editor mit Name, Verfahren, Beschreibung
    und Rasten (Temperatur, Dauer). Aufheizzeiten gehören nicht zum Profil, sie rechnet das Rezept mit der
    Heizrate des Sudhauses.
  - **Mitgelieferte Profile** sind schreibgeschützte Vorlagen; geändert wird eine Kopie (Duplizieren).
    Umgesetzt (3c): Hochkurz, Einrast-Infusion, Weizen mit Ferulasäurerast, Klassisch mit Eiweißrast und
    Kombirast 66 °C; seit 3d außerdem Einmaisch-, Zweimaisch- und Dreimaischverfahren und Earls
    Kochmaische, seit 2026-10-10 Weizen nach Herrmann (Maltaserast). Alles Richtwerte (`TODO(verify)` in
    `web/src/mashProfiles.ts`).
- **Verfahren (Infusion/Dekoktion)** hat keinen eigenen Schalter mehr. Es ergibt sich aus den Schritten im
  Maischeplan: Enthält er einen Schritt Dekoktion, ist es ein Dekoktionsverfahren. Das Sudhaus bestimmt,
  was möglich ist und wie geheizt wird:
  - **Maischeheizung** aus dem Schritt Maischen des Sudhauses: direkt beheizt, HERMS, Kettle-RIMS, RIMS
    oder Aufguss (`heatingOf` in `web/src/brewhouse.ts`).
    Bei Aufguss rechnet das Rezept Zubrühmengen statt Heizzeiten.
  - **Dekoktion möglich**, wenn es neben dem Maischbehälter einen zweiten Behälter mit eigener Heizquelle
    gibt, der die Teilmaische kochen kann. Das wird aus dem Sudhaus abgeleitet, einen Schalter gibt es
    nicht. Sonst ist die Schritt-Art Dekoktion im Rezept ausgegraut, mit Hinweis aufs Sudhaus.
  - Wechselt das Rezept auf ein Sudhaus ohne Dekoktion, warnt es (Übersicht und Maischen-Tab) und bietet an,
    die Dekoktionen durch Rasten auf dieselbe Temperatur zu ersetzen. Bis dahin zählen sie als Rasten.
- **Kopfkarte Maischen:** Konversion (Eingabe oder berechnet), Malztemperatur (Brauerei), Siedepunkt, Heizung,
  Heizrate (Sudhaus oder aus der Heizleistung geschätzt) und Gesamtdauer, alles nur lesbar.
  Die Einmaischtemperatur steht im Plan beim Schritt Einmaischen, die berechnete Hauptguss-Temperatur
  beim Schritt Wasser vorlegen.
- **Stand 3a (2026-10-08, `web/src/mashPlan.ts`, `pages/recipe/MashTab.tsx`):** Maischeplan,
  Wärmerechnung, Teilschüttungen, Temperaturverlauf und Siedepunkt sind umgesetzt. Maischprofile (3c) und
  Dekoktion (3d) stehen unten.
  - **Schritt-Modell:** Jeder Schritt hat eine Zieltemperatur und eine Haltedauer; die Art bestimmt nur den
    Übergang (Heizen, Abkühlen, Mischen, Zubrühen). Das hält das Modell flach für die Programmschritte des
    Suds. „Wasser vorlegen“ und das erste „Einmaischen“ lassen sich weder löschen noch verschieben.
  - **Alte Rezepte** (Rasten ohne Art) verlieren ihren Plan beim Laden, eine Migration gibt es nicht
    (Entscheidung 2026-10-08). Der Plan beginnt dann mit Wasser vorlegen und Einmaischen (67 °C, 60 min).
  - **Wärmeäquivalent:** M = Wasser [kg] + 0,41 × Malz [kg]; die 0,41 teilt sich die Rechnung mit der
    Einmaischtemperatur (`GRAIN_HEAT_RATIO`). Die Wärmekapazität des Behälters bleibt wie bei Palmer
    unberücksichtigt.
  - **Wasser vorlegen:** Menge = Hauptguss − alle Zubrühmengen. Zubrühmengen, die nach Temperatur
    geführt werden, wachsen mit der Maische; die Menge wird deshalb per Bisektion gelöst. Sind die
    Zubrühmengen größer als der Hauptguss, gibt es einen Hinweis und das Zubrühwasser kommt hinzu.
    Temperatur über die Einmaischformel mit der ersten Schüttung, Heizzeit ab Leitungswasser.
  - **Weitere Schüttung:** Mischtemperatur (M·T + 0,41·kg·T_Malz) / (M + 0,41·kg), nur lesbar.
  - **Zubrühen:** (M·T_alt + V·T_w) / (M + V) = T_ziel. Was zuletzt geändert wurde, führt (Menge oder
    Wassertemperatur); ohne Wassertemperatur gilt der Siedepunkt. Eis zählt als Wasser von
    −334/4,186 ≈ −79,8 °C. Liegt die nötige Wassertemperatur außerhalb von Leitungswasser bis Siedepunkt,
    gibt es einen Hinweis. Zubrühwasser ist Teil des Hauptgusses und wird mit ihm aufbereitet.
  - **Rast:** Heizen ΔT / Heizrate des Sudhauses; fehlt sie, P · 0,85 / (M · 4186) · 60 K/min aus der
    Heizleistung, mit Hinweis. Abkühlen passiv mit 0,2 K/min, mit Hinweis „kalt zubrühen?“. Beide
    Konstanten sind Annahmen (`TODO(verify)`).
  - **Aufguss-Sudhaus:** Eine wärmere Rast wird durch Zubrühen mit Wasser am Siedepunkt erreicht und
    zählt zum Hauptguss.
  - **Teilschüttungen:** `Recipe.charges` (ohne Eintrag genau eine), `Ingredient.chargeId` und
    `MashStep.chargeId`. „Schüttung aufteilen“ teilt jedes Malz der gewählten Schüttung im Verhältnis
    auf, die kg je Malz bleiben gleich. Entfernen einer Schüttung legt ihr Malz mit gleichen Zeilen der
    ersten zusammen. Der Zutaten-Tab markiert die Schüttung. Die Summen je Schüttung (°P, EBC) sind ihr
    Anteil am Extrakt bzw. an den MCU.
  - **Temperaturverlauf** mit uPlot: Rampen und Haltestufen ab dem Aufheizen des Hauptgusses, Punkte
    und Namen bei den Zugaben. Ohne Sudhaus (seit 2026-10-10, `outlineMash`) nur die Zieltemperaturen
    und Haltezeiten ab dem Einmaischen, Übergänge als Sprung, mit Hinweis; Schritte ohne Zieltemperatur
    (weitere Schüttung) behalten die vorige, eine Kochrast endet am Siedepunkt der Brauerei.
  - Der Maische-pH (2b-2) rechnet weiter mit der ganzen Schüttung und dem ganzen Hauptguss.
- **Würzekochen** (Tab): Karte „Kochen & Whirlpool“ mit Kochdauer, Nachisomerisierung, Whirlpool-Temperatur
  und -Dauer, darunter eine Zeitleiste der Gaben (Läutern/Vorderwürze · Kochen · Nachisomerisierung ·
  Whirlpool). Danach die Zutaten (Vorderwürze, Kochen, Whirlpool) und der Hinweis, wenn das Sudhaus keinen
  Hop Back hat.
- **Stand 3c (2026-10-09, `web/src/mashProfiles.ts`, `pages/recipe/MashProfileDialog.tsx`):** Maischprofile.
  - **Ablage:** `/mashprofiles/<id>.json` auf der SD (`JsonDocDir`, Routen `GET /api/mash-profiles`,
    `PUT`/`DELETE /api/mash-profiles/:id`, nur SD-Boards, kein Index). Die Firmware prüft nur die `id`. Im
    Code heißt das `mashProfile`; die Reglerprogramme unter `/api/profiles` sind etwas anderes. Die fünf
    mitgelieferten Profile stehen im Web-UI und nicht auf der SD, sie sind schreibgeschützt.
  - **Inhalt:** Name, Verfahren (freier Text), Beschreibung, `doughIn` (Temperatur und Dauer) und `steps`
    (nur Rast und Zubrühen, je Name, Temperatur, Dauer). **Abweichung vom ersten Entwurf:** Das feste
    Einmaischen gehört nicht als Schritt ins Profil, aber seine Temperatur und Dauer sind die erste Rast
    der Folge (Weizen: 45 °C zuerst), also stehen sie im Profil. Seit 3d auch Dekoktionen und weitere
    Schüttungen (unten).
  - **Laden** („Profile ▾“, nach Bestätigung): behält die beiden festen Schritte, setzt Temperatur und Dauer
    des Einmaischens aus `doughIn` und ersetzt alle weiteren Schritte durch `steps`. Zubrühen kommt als
    Wasser am Siedepunkt, die Menge rechnet der Plan. Weitere Schüttungen behandelt 3d (unten).
  - **Speichern** („Plan als Profil speichern“): übernimmt Einmaischen und alle Rasten und Zubrühschritte;
    Mengen des Zubrühens und Heizzeiten bleiben draußen.
  - **Backup:** `/mashprofiles` liegt wie `/brewhouses` außerhalb von `/config` und ist nicht im Backup.
- **Stand 3d (2026-10-09, `web/src/mashPlan.ts`, `web/src/mashProfiles.ts`, `pages/recipe/MashTab.tsx`):**
  Dekoktion, Kochen im Maischbehälter und Profile mit Dekoktion und weiteren Schüttungen. Entscheidungen des
  Nutzers vom 2026-10-09.
  - **Dekoktionsbehälter** (`decoctionVesselOf` in `web/src/brewhouse.ts`): ein Behälter, der nicht der
    Maischbehälter ist, eine eigene Heizquelle hat und die Maische nicht heizt. Der Behälter, über den die
    Maische indirekt geheizt wird (HERMS-Spirale, Kettle-RIMS, Aufguss), hält beim Maischen Wasser und
    zählt nicht. Gewählt wird der erste in der Prozessreihenfolge. Vorlagen: „Pfanne + Läuterbottich“ →
    Einkocher, „3-Kessel-HERMS“ → Würzepfanne; Ein-Topf, Malzrohr und 2-Kessel-HERMS können keine
    Dekoktion.
  - **Schritt:** `MashStep.decoction` = `{ lead, sharePct?, thin?, rests[], boilMin }`. `tempC` ist die
    Temperatur nach dem Zurückführen, `durationMin` die Haltedauer der ganzen Maische danach; das
    Schritt-Modell bleibt flach. Gezogen wird am Ende der vorigen Haltezeit, die Restmaische rastet derweil
    weiter. Beginn ist das Zurückführen.
  - **Zusammensetzung:** Der Anteil bezieht sich auf das Maischevolumen V = Wasser + 0,75 l/kg · Malz.
    Dick nimmt Malz mit bis zu 2,1 l Wasser je kg (etwa 1 qt/lb, BrewUnited; dünnere Maische gibt das
    her, `TODO(verify)`), darüber hinaus Flüssigkeit; dünn nimmt nur Flüssigkeit.
  - **Ablauf im Dekoktionsbehälter:** die Rasten der Teilmaische, dann Heizen auf den Siedepunkt nach Höhe
    und Kochen. Heizrate aus der Heizleistung für die Masse der Teilmaische, P · 0,85 / (M_d · 4186) · 60;
    ohne Leistung die Heizrate des Schritts, den die Heizquelle sonst heizt (gilt für die volle Füllung,
    mit Hinweis). **Abweichung vom ersten Vorschlag:** dort stand die Heizrate des Schritts zuerst; sie
    gilt aber für den vollen Behälter, eine Teilmaische mit 8 l heizt etwa dreimal so schnell.
  - **Verdampfung** beim Kochen mit der Verdampfung des Dekoktionsbehälters (Feld im Sudhaus, sonst 0 l/h
    mit Hinweis). Sie fehlt der Maische danach und zählt im Wasser-Tab zum Gesamtwasser
    (`mashEvaporationL` in `web/src/recipeWater.ts`; mit Nachguss als Nachguss, sonst als Hauptguss); der
    erste Ablauf im Läutermodell ist um sie kleiner.
  - **Restmaische:** verliert den Wärmeverlust des Maischbehälters (`Vessel.heatLossKPerH`, K/h, Vorgabe
    0 = hält die Temperatur) über die Dauer D der Dekoktion: T_r = T_s − Verlust · D / 60.
  - **Zurückführen:** T = (M_r · T_r + (M_d − E) · T_siede) / (M_r + M_d − E), M nach dem Wärmeäquivalent.
    Führt die Temperatur, wird der Anteil per Bisektion gesucht (die Dauer hängt über die Heizzeit vom
    Anteil ab). Gegenprobe: Eine dünne Dekoktion ohne Verlust und Verdampfung ergibt genau Troesters
    Faustformel s = (T_z − T_s) / (T_siede − T_s), bezogen auf das Wärmeäquivalent (Palmer rechnet dieselbe
    Bilanz mit 0,4 für das Malz). Troesters pauschaler Zuschlag von 15–20 % steckt hier in Verlust und
    Verdampfung. Hinweise: Ziel nicht über der Maische, auch mit der ganzen Maische nicht erreichbar,
    Teilmaische größer als der Dekoktionsbehälter.
  - **Kochen im Maischbehälter:** Eine Rast mit Ziel ab Siedepunkt heizt auf den Siedepunkt nach Höhe und
    kocht über ihre Dauer („Heizen … · Kochen“), mit der Verdampfung des Maischbehälters. Nur bei direkt
    beheiztem Maischbehälter, sonst Hinweis. Das Feld Verdampfung erscheint im Sudhaus deshalb auch am
    Dekoktionsbehälter und am direkt beheizten Maischbehälter.
  - **Ohne Dekoktionsbehälter** zählt eine Dekoktion wie eine Rast (ein Hinweis nennt sie). Übersicht und
    Maischen-Tab bieten „Dekoktionen durch Rasten ersetzen“ an (`replaceDecoctions`, gleiche Temperatur
    und Dauer).
  - **UI:** In der Zeile Anteil (%), dick/dünn und Volumen; darunter die Teilmaische mit Rasten, Kochdauer,
    Temperatur der Restmaische und Verdampfung. Der Temperaturverlauf zeigt die Teilmaische als zweite,
    gestrichelte Linie; die Hauptlinie zeigt derweil die Restmaische.
  - **Profile:** Schritte dürfen Dekoktion (`decoction`: dick/dünn, Rasten, Kochdauer; beim Laden führt die
    Temperatur) und Einmaischen einer weiteren Schüttung sein (`doughIn` mit `sharePct`, Anteil an der
    ganzen Schüttung); Zubrühen trägt optional `waterTempC`. Beim Laden bekommt die n-te weitere Schüttung
    des Profils die n-te des Rezepts; fehlt sie, teilt das Laden den Anteil von der ersten ab wie
    „Schüttung aufteilen“. Überzählige Schüttungen verlieren ihren Einmaisch-Schritt. Die Bestätigung
    nennt beides. Speichern übernimmt Dekoktionen (bei geführtem Anteil mit der erreichten Temperatur) und
    weitere Schüttungen mit ihrem kg-Anteil.
  - **Neue mitgelieferte Profile:** Einmaischverfahren (50 °C, eine dicke Kochmaische auf 64 °C),
    Zweimaischverfahren (50 → 64 → 72 °C mit zwei dicken Kochmaischen), Dreimaischverfahren (37 → 52 → 64 °C
    dick, Läutermaische dünn auf 76 °C) und Earls Kochmaische (hobbybrauer.de, Thema 461: 80 % der
    Schüttung bei 62 und 72 °C verzuckern, kochen, mit kaltem Wasser auf 62 °C, die übrigen 20 %
    einmaischen, dann 63/72/78 °C).
  - **Weizen nach Herrmann (Maltaserast)** (2026-10-10, ohne Dekoktion): Markus Herrmann (TU München,
    Weihenstephan) erhöht die Glucose in der Würze und damit die Bananenester (Isoamylacetat). Die erste
    Hälfte der Schüttung rastet bei 62 und 72 °C, kaltes Wasser kühlt auf 46 °C, die zweite Hälfte kommt
    dazu (Mischung um 45 °C), ihre Maltase spaltet in 40 min bei 45 °C Maltose zu Glucose; danach 72 und
    76 °C. Ablauf nach brewingforward.com „Maltase mash“ (beruft sich auf Kunze und Esslinger), Aufteilung
    50:50 nach edelstoffquest.wordpress.com; die Dissertation selbst ist nicht gelesen. Die Variante mit
    zwei Dekoktionen (Edelstoffquest) ist nicht mitgeliefert.
- **Stand 3e (2026-10-14, `web/src/mashPlan.ts`, `recipes.ts`, `pages/recipe/MashTab.tsx`, `recipeDiff.ts`):**
  zwei Schalter am Maischeplan. Entscheidungen des Nutzers vom 2026-10-14.
  - **Restmaische halten** (`Decoction.holdRest`, Haken je Dekoktion neben der Kochdauer): Die Restmaische
    bleibt während der Dekoktion auf ihrer Temperatur, T_r = T_s. Ohne Haken gilt weiter der Wärmeverlust
    des Maischbehälters. Das wirkt nur, wenn der Maischbehälter beheizt ist (Heizquelle, nicht Aufguss);
    sonst rechnet der Plan mit dem Verlust und nennt das in einem Hinweis. Bei einem Verlust von 0 K/h
    ändert der Haken die Rechnung nicht, wohl aber das Maischprogramm (Stand 5b-5).
  - **Aufheizzeit zählt zur Rast** (`Recipe.mashRampInRest`, ein Haken unter dem Maischeplan, Vorgabe aus):
    Die Dauer einer Rast läuft ab Beginn des Aufheizens oder Abkühlens, wie viele Hobbybrauer den Timer
    stellen. Auf Temperatur bleibt Dauer minus Übergang, mindestens 0 (dann ein Hinweis); die Maischdauer
    wird um die Übergänge kürzer. Die Zeile trägt `rampInRest`.
    - Gilt für Rasten mit Dauer, die durch Heizen oder Abkühlen erreicht werden, und für die Rasten der
      Teilmaische im Dekoktionsbehälter. Mischen (Einmaischen, Zubrühen), das Zurückgeben einer Dekoktion
      und der Hauptguss haben keine Rampe, die zählen könnte.
    - Ohne bekannte Heizrate ist der Übergang 0 min; der Plan zeigt dann die volle Dauer.
    - Eine kochende Rast verdampft weiter über ihre ganze Dauer (Vereinfachung).
  - **Versionsvergleich:** Zeile „Restmaische“ (gehalten / unbeheizt) je Dekoktion und „Aufheizzeit zählt zur
    Rast“ (ja / nein) beim Maischeplan.
  - **Profile** tragen beide Schalter nicht: Der eine hängt am Sudhaus, der andere gilt fürs ganze Rezept.
- **Offen:** Läutern als eigener Schritt (Läuterruhe, Nachguss in Portionen; das
  Verfahren Batch oder Fly Sparge steht seit 3b im Wasser-Tab).
- **Ausgangstemperatur des Hauptgusses** für die Heizzeit ist die Leitungswassertemperatur der
  Brauerei-Ebene (statt der früheren Annahme 14 °C); im Sud gilt der am Brautag gemessene Wert.

### Effizienz
Umgesetzt mit Etappe 3b (2026-10-09, `web/src/efficiency.ts`). Quelle: Kai Troester, „A Closer Look at
Efficiency“ (NHC 2010, <https://braukaiser.com/documents/Troester_NHC_2010_Efficiency.pdf>) und sein
Wiki-Artikel „Understanding Efficiency“ (braukaiser.com); Namen wie bei Malzknecht und Brewfather.

- **Kette** (alle Werte Extrakt in kg, bezogen auf den Laborextrakt der Schüttung lufttrocken, das
  Potenzial; nur die Sudhausausbeute bezieht sich auf das Gewicht):

  | Glied | Bedeutung |
  |---|---|
  | Konversion | in der Maische gelöster Extrakt / Potenzial. Vorgabe aus dem Sudhaus (Feld `mashEfficiencyPct`, neue Sudhäuser 80 %; Troester nennt 95–100 % gut) |
  | Läutereffizienz | Anteil des gelösten Extrakts, der in die Pfanne kommt; Modell, siehe unten |
  | Maischeeffizienz | Konversion × Läutereffizienz = Extrakt in der Pfanne / Potenzial (bis 3b hieß dieser Wert im Rezept „Sudhausausbeute“) |
  | Sudhausausbeute | Extrakt in der Pfanne je kg Schüttung (Narziss) = Maischeeffizienz × Potenzial je kg, rund 0,77 × Maischeeffizienz |
  | Brewhouse-Efficiency | Maischeeffizienz × Würzeanteil = Extrakt im Gärbehälter / Potenzial |

  Schüttung heißt hier Malz und Rohfrucht. Zucker und Extrakt laufen nicht durch die Kette, ihr Extrakt
  kommt ganz hinzu.
- **Getrennt**, weil nur die Konversion am Sudhaus und am Verfahren hängt (Schrot, pH, Rasten). Die
  Läutereffizienz hängt am Rezept: Ein Starkbier verliert mehr im Treber, Vollguss läutert schlechter als
  Nachguss. Ein fester Wert für Maischen und Läutern zusammen würde ein Starkbier zu stark vorhersagen.
- **Grundlage** (Karte „Brauerei“, `Brewery.efficiencyBasis`): Konversion, Maischeeffizienz (Vorgabe, das
  Verhalten vor 3b), Sudhausausbeute oder Brewhouse-Efficiency. Das Rezept gibt genau diesen einen Wert
  ein, das Feld in der Übersicht trägt seinen Namen; die übrigen folgen. Maischeeffizienz, Sudhausausbeute
  und Brewhouse-Efficiency teilen sich `recipe.efficiencyPct` (ohne Wert 75, 60 bzw. 70 %); ein Wechsel der
  Grundlage deutet die gespeicherte Zahl um. Die Konversion kommt aus dem Sudhaus, das Rezept kann sie
  überschreiben (`recipe.conversionPct`, eigenes Feld, weil fast alle Rezepte `efficiencyPct = 75`
  gespeichert haben).
- **Läutermodell** (Troesters Batch-Sparge-Modell): Jeder Ablauf V nimmt V / (V + R) des Extrakts mit, der
  noch im Bottich ist. R ist die zurückgehaltene Würze: Treberverlust und Würzeverluste vor dem Kochen aus
  dem Wasser-Tab plus das Volumen des gelösten Extrakts (0,62 l/kg). Der Treberverlust im Wasser-Tab ist
  das verlorene Wasser; die zurückgehaltene Würze trägt den Extrakt dazu (Troester: wahre Aufnahme rund
  1,56 l/kg gegenüber rund 1 l/kg scheinbarer).
  - **Vollguss:** ein Ablauf, Hauptguss − Treberverlust − Würzeverluste (= Pfannevoll).
  - **Batch Sparge mit n Gaben** (Vorgabe 1): erster Ablauf wie oben, dann n gleich große Gaben aus dem
    Nachguss.
  - **Fly Sparge:** kein belastbares Modell; gerechnet wie Batch Sparge mit 2 Gaben, mit Hinweis. Ein
    Festwert im Sudhaus (`lauterEfficiencyPct`, aus eigenen Suden) ersetzt die Näherung, nur bei Fly Sparge.
  - Abgleich mit Troester: Vollguss bei 15 % Verdampfung 82 % bei 10 °P, 71 % bei 16 °P Stammwürze
    (Modell: 83 und 72 %); 0 → 1 → 2 → 3 Gaben +8, +3, +1 Punkte (Modell: +9, +3,4, +1,8); 30/70 statt
    50/50 kostet 1 Punkt (Modell: 0,9).
- **Würzeanteil:** Würze im Gärbehälter / Ausschlag nach dem Abkühlen. Es zählen Totraum und Transfers ab
  dem Whirlpool; der Kühlschwund verliert Volumen, aber keinen Extrakt, er steckt in der kalten Stammwürze
  (siehe Wasser › Ausschlagmenge). Hopfenaufnahme und Trub kommen mit dem Gärung-Tab.
- **Rechnung:** Die Läutereffizienz hängt vom gelösten Extrakt ab und über einen nach Stammwürze geführten
  Verschnitt von den Wassermengen; sie wird iteriert, bis sie steht (wenige Runden).
- **Anzeige:** Die Kennwerte der Übersicht zeigen die Kette, die Eingabe als Abzeichen markiert. Ohne
  Sudhaus fehlen Konversion, Läutereffizienz und Brewhouse-Efficiency; mit der Grundlage Konversion gibt es
  dann keine Stammwürze. Hinweise: Konversion über 100 % (die Eingabe ist für dieses Läutern zu hoch),
  Fly-Sparge-Näherung. Der Wasser-Tab zeigt die Läutereffizienz neben den Mengen, die Kopfkarte im
  Maischen-Tab die Konversion.
- **Messung Vorderwürze** (°P, Schritt Läutern): Damit bestimmt der Sud später die Konversion (Troesters
  „Mash Gravity Test“).

### Gärung
**Stand 5c-1 (2026-10-14, `web/src/fermentation.ts`, `pages/recipe/FermentationTab.tsx`, `PhaseList.tsx`,
`IngredientCard.tsx`, `recipeWater.ts`):** Der Tab hat vier Karten: Gärführung, Zutaten, Karbonisierung und
Abfüllmenge. Mit dem Heiß/Kalt-Schalter (5c-1b, Wasser › Wassermenge) kann die Rezeptmenge auch die
Anstellwürze sein; die Berechnung nennt dann sie als Rezeptwert, nicht den Ausschlag.
- **Gärführung:** Phasen mit Rampe ab Phase 2 (`rampDays`, zählt zur Dauer) und mit dem Schalter „Unter Druck
  vergären“ (`pressureFermentation`) einem Druck je Phase (`pressureBar`). Eine neue Phase startet mit 20 °C und
  7 Tagen. Es gibt zwei Hinweise: Die Rampe ist länger als die Phase, und kein Gärplatz ist bis zum höchsten Druck
  druckfest.
- **Zutaten:** Hopfen haben eine Form (`form`). Ohne Angabe gilt die Form des Lagerpostens, sonst T90; die Auswahl
  zeigt das als „T45 (Lager)“ bzw. „T90 (Vorgabe)“. Hopfen und Aroma bei Hauptgärung oder Reifung haben „Tag“ und
  „Tage“ (`dryHopDay`, `dryHopDays`).
- **Karbonisierung** (`carbonation`): Verfahren, Ziel in vol CO₂, bei Zucker die Zuckerart.
  - Die Restkohlensäure kommt aus der höchsten Phasentemperatur.
  - Zucker: `primingSugarGrams` für das Bier vor dem Abfüllen.
  - Speise: Menge aus der Kette (unten).
  - Grünschlauchen: scheinbarer Extrakt zum Schlauchen, `krausenRackingPlato`. Restextrakt + der Extrakt, dessen
    CO₂ (Balling: 2,0665 g Extrakt → 0,9565 g CO₂) das Ziel auffüllt.
  - Zwangskarbonisierung: Überdruck bei der Temperatur der **letzten Phase** (Nutzer), `forcedCarbonationBar`.
    Dafür nutzt sie die übliche Regression in psi/°F.
- **Abfüllmenge** (`calcBottling`):
  - **Anstellwürze** = Ausschlag − Kühlschwund − Totraum und Transfers ab Whirlpool − Hopfen im Kessel − Speise
    + Verschnitt im Gärbehälter.
  - Bei einem Verschnitt im Keg: + Verschnitt nach Jungbier und Speise (seit 2026-10-18).
  - **Jungbier** = Anstellwürze − Trub (`trubLossL`, ohne Angabe 0 l, Nutzer) − Hopfen im Gärbehälter (Dip,
    Hauptgärung, Reifung).
  - **Abgefüllt** = Jungbier + Speise − Abfüllverluste.
  - **Gebinde** (`bottling.containers`): Zeilen Gebinde × Anzahl. Nur die letzte Zeile darf ohne Anzahl sein und
    bekommt so viele ganze Gebinde (Größe + Abfüllverlust), wie das Bier hergibt. Was in kein ganzes Gebinde passt,
    steht als „Rest“. Ohne Gebinde zählt das ganze Bier als abgefüllt.
  - Darstellung: Kennzahlen, Balken „Verbleib“ und „Berechnung“ wie im Wasser-Tab.
- **Aufnahme je Form** in ml/g (`TODO(verify)`, nur Faustwerte, für Dolden etwa 5–6 ml/g; gemessene Werte gibt es
  laut MBAA 2017 nur nach Gewicht):

  | Form | Kessel | Gärbehälter |
  |---|---|---|
  | Dolde | 8 | 7 |
  | T90 | 5 | 5 |
  | T45 | 4 | 4 |
  | Lupulin | 3 | 3 |
  | Extrakt | 0 | 0 |

  Im Kessel zählen Vorderwürze, Kochen, Whirlpool und Hop Back. Maischehopfen bleibt im Treber.
- **Überall eingerechnet** (Nutzer: „jetzt in 5c-1“):
  - Hopfen im Kessel und Speise mindern die Würze, die im Gärbehälter ankommt (`fermenterIntake`,
    `resolveDilution`). Damit ändern sich der Verschnitt im Gärbehälter (Wasser-Tab) und die Stammwürze nach ihm.
  - Die Speise wird bei der Stammwürze der Ausschlagwürze abgezweigt. Ihr Anteil bezieht sich auf das Bier vor dem
    Abfüllen. Bei einem Verschnitt nach Stammwürze hängen Speise und Verschnitt aneinander; das löst eine
    Fixpunktschleife.
  - **Effizienz „im Gärbehälter“** (`fermenterShare`) zieht nur den Hopfen ab, **nicht die Speise**. Ihr Extrakt
    kommt beim Abfüllen ins Bier, und die Grundlage „Brewhouse-Efficiency“ hinge sonst von sich selbst ab
    (Speise ← Stammwürze ← Maischeeffizienz ← Anteil).
  - Den Rechenweg reicht `wortExtract` als `draw` (`wortDraw`) an `calcWater`/`resolveDilution` weiter.
- **Versionen vergleichen** zeigt die neuen Felder: Rampe, Druck, Druckgärung, Trub, Karbonisierung, Gebinde,
  Hopfenform und Stopfen.

Konzept (vor 5c-1):
- Zutaten-Karte mit Anstellen, Hauptgärung, Reifung · Stopfen und Abfüllung · Karbonisierung; sie ersetzt die
  frühere reine Hefe-Anzeige.
- Gärführung als Phasen mit Temperatur, Dauer, Rampe und optional Druck (Schalter „Unter Druck vergären“).
- Karbonisierung: Grünschlauchen, Zucker, Speise oder Zwangskarbonisierung. Bei Speise wird die Restmenge
  CO₂ aus der Höchsttemperatur nach Gärende berechnet.
- **Abfüllmenge** (vom Wasser-Tab hierher verschoben): vorwärts vom Ausschlag bis zur Abfüllung.
  - Ausschlag − Volumenschwund beim Abkühlen (%) − Würzeverlust (Trub, Hopfen, Kühler) − Speise = Anstellwürze.
  - Anstellwürze − Trub im Gärbehälter − Stopfhopfen (l/100 g × Stopfhopfenmenge) = Jungbier.
  - Jungbier + Speise − Abfüllverlust (aus dem Gebinde im Gärkeller) = Abgefüllt, mit Flaschenzahl.
  - Der Trubverlust im Rezept ist eine Annahme. Im Sud gilt der Wert des gewählten Gärplatzes.
  - Darstellung wie beim Wasser: Kennzahlen (Anstellwürze, Jungbier, Abgefüllt), Balken (Verbleib der
    Ausschlagwürze) und Aufklappbereich „Berechnung“.
  - Hopfenaufnahme im Kessel und beim Stopfen: je Form, Werte siehe Stand 5c-1.

### Sude (Tab im Rezept)
- Knopf „Neuer Sud aus diesem Rezept“, bei Entwürfen und ungespeicherten Änderungen gesperrt.
- Tabelle der Sude aller Versionen mit Nr., Version, Brautag und Status (seit 5a). Mit 5b kommen
  Stammwürze Soll/Ist, Maische- und Gesamteffizienz und abgefüllte Menge dazu, dazu ein Diagramm der
  Effizienz über die Sude.

## Profile (Menü „Profile“, seit 2026-10-18)

Eine Seite für alle bierbezogenen Profile (`pages/BrewProfilesPage.tsx`, Route `/profile/<tab>`, Paket
`recipes`). Je Art ein Tab mit zwei Tabellen im Stil der Rezeptliste, **Eigene** (Zeile öffnet den Editor;
bearbeiten, duplizieren, löschen) und **Mitgeliefert** (schreibgeschützt; „Duplizieren“ legt ein eigenes
Profil an); die Titel stehen über den Tabellen, ohne Anzahl, und in der Zeile von „Eigene“ steht rechts der
Knopf für ein neues Profil (auch am Handy, kein FAB). Keine Suche (Nutzer, 2026-10-18)
(`pages/profiles/ProfileList.tsx`, Spalten je Tab). Die Spalten erscheinen ab `lg`, darunter zeigt jede Zeile
Name und eine Kurzzeile. Die Reglerseite, die bis dahin „Profile“ hieß, heißt jetzt
**Programmvorlagen** (`/vorlagen`); ihre API `/api/profiles` ist unverändert.

Entscheidungen des Nutzers (2026-10-18): Wasserprofile bekommen eine eigene Ablage wie die Maischprofile; im
Rezept-Editor bleibt für Maisch- und Gärprofile nur Laden und Speichern, gepflegt wird auf der Seite; ein
Gärprofil sind die Phasen und der Haken Druckgärung; eigene Bierstile, bis die BJCP zustimmt, mit einem
Stil-Dialog, der die Stilquelle per Dropdown wählt. Umsetzung in vier Etappen: A Wasser (erledigt), B Maische,
C Gärung, D Bierstile.

- **Wasser:** Analysen mit Ca, Mg, Na, K, Cl, SO₄, HCO₃ in mg/l, optional pH und Notiz, im Dialog. Eingabehilfen
  rechnen KS4,3 (× 61,02) oder Karbonathärte (°dH × 21,8) in HCO₃ um, Calcium- und Magnesiumhärte (°dH × 7,14
  bzw. × 4,34) in Ca und Mg; weicht die Ionenbilanz um mehr als 10 % ab, erscheint ein Hinweis. VE-Wasser ist
  mitgeliefert und wird nicht gespeichert. Tabellenspalten: Name (Notiz darunter), Ca, Mg, Na, K, Cl, SO₄,
  HCO₃ in mg/l, Restalkalität in °dH, pH. Das Standardwasser wird nicht hier eingestellt, sondern in der Anlage
  (Nutzer, 2026-10-18); löscht man es hier, fällt die Wahl zurück auf „erstes Profil“.
- **Zielwasser:** eigene Zielprofile (`target: true`) und die mitgelieferten (siehe Wasser › Aufbereitung,
  „Ziel“). Ein Zielprofil ist kein Ausgangswasser; der Tab bestimmt, was ein neues Profil ist, den Haken
  „Zielprofil“ gibt es nicht mehr.
- **Ablage:** `/api/water-profiles`, eine Datei je Profil (`/waterprofiles/<id>.json`). `getBrewery()` holt die
  Profile von dort und hängt sie im Speicher als `Brewery.waters` an, `saveBrewery()` lässt das Feld weg. So
  rechnen Rezepte und die eingefrorene Brauerei eines gestarteten Suds unverändert. **Umzug:** Stehen noch
  Profile in `/brewery.json`, schreibt der erste Ladevorgang die fehlenden mit derselben id in die Sammlung
  (Rezeptverweise bleiben gültig) und speichert die Brauerei danach ohne sie; war kein Standardwasser gewählt,
  wird das erste Ausgangswasser der alten Liste zum Standardwasser, damit Rezepte ohne Wahl gleich rechnen.
  Scheitert ein Schritt, bleibt `/brewery.json` unverändert und der Umzug läuft beim nächsten Laden erneut.

## Anlage (Einstellungen › Brauanlage)

Die Anlage ist in **Sudhaus** und **Gärkeller** geteilt. Die meisten Brauer haben ein Sudhaus, aber oft
mehrere Gärplätze, sodass mehrere Sude gleichzeitig aktiv sein können.

Über den Sudhäusern steht die **Brauerei**: Malztemperatur und Leitungswassertemperatur hängen am Standort,
nicht an der Anlage, und werden deshalb einmal für alle Sudhäuser gepflegt. Sie sind Vorgabe für die
Rezept-Rechnungen und Vorbelegung im Sud; die Werte vom Brautag trägt der Sud als Messung ein.

Die **Wasserprofile** standen bis 2026-10-18 ebenfalls hier; sie sind auf die Seite Profile umgezogen (siehe
dort), die Karte Brauerei verweist mit einem Link darauf. Hier bleibt das **Standardwasser** (Nutzer,
2026-10-18), das Ausgangswasser von Rezepten, die keines wählen; ohne Wahl gilt das erste Profil (nach
Namen), ohne Profil VE-Wasser. Rezepte lesen es beim Rechnen, ändert es sich, rechnen auch bestehende Rezepte
ohne eigene Wahl damit.

Ebenfalls dort steht die **Höhe** (seit 3a, m ü. NN). Daraus folgt der Siedepunkt nach der
Normatmosphäre: p = 1013,25 · (1 − 2,25577·10⁻⁵ · h)^5,25588 hPa, Siedepunkt nach Clausius-Clapeyron mit
ΔH = 40 660 J/mol (500 m ≈ 98,3 °C), ohne Erhöhung durch den Extrakt. Er begrenzt Hauptguss und Zubrühen
und geht in die Bittere ein: Die Kochausnutzung (Tinseth) wird mit der Isomerisierungsrate nach Malowicki
relativ zu 100 °C skaliert. Der Sud nutzt später die Messung **Luftdruck** (Schritt Kochen, hPa), die das
Sudhaus mit einem Drucksensor verknüpfen kann.

Ebenfalls dort steht das **pH-Modell** (seit 2b-2), eines für alle Rezepte: Troester (pH aus Malzdaten,
Vorgabe) oder Kolbach (Restalkalität nach Bierfarbe, ohne pH). Siehe Wasser › Aufbereitung.

Ebenfalls dort steht die **Grundlage der Effizienz** (seit 3b), eine für alle Rezepte: Konversion,
Maischeeffizienz (Vorgabe), Sudhausausbeute oder Brewhouse-Efficiency. Siehe Rezept › Effizienz.

### Sudhaus
Umgesetzt seit 2026-10-04 (Etappe 1, `web/src/brewhouse.ts`, `/api/brewhouses`, `/api/brewery`), nur auf
SD-Boards und im Paket `recipes`. Rezepte wählen ihr Sudhaus seit Etappe 2a in der Übersicht.

- **Prozessschritte werden frei auf Behälter verteilt.** Schritte: Hauptguss bereiten · Maischen · Läutern ·
  Nachguss bereiten · Kochen · Whirlpool · Hop Back · Kühlen. Pflicht sind Maischen, Läutern und Kochen. Je
  Schritt gibt es genau einen Behälter; einen Schritt, den kein Behälter übernimmt, gibt es in diesem Sudhaus
  nicht. Ohne Nachguss kann das Sudhaus nur Vollguss (der Wasser-Tab sperrt dann „Mit Nachguss“).
- **Kombinationen:** Maischen und Läutern in einem Bottich; Maische-/Würzepfanne mit separatem
  Läuterbottich; ein Topf für alles (Sack, Malzkorb oder Ablassen in einen Zwischenbehälter);
  2-Kessel-HERMS (Kochen und Nachguss in einem Kessel). Vorlagen: Ein Topf (Sack/Malzkorb), Ein Topf mit
  Malzrohr, Maische-/Würzepfanne + Läuterbottich, 2- und 3-Kessel-HERMS, Leer. Alle Geräte stehen dort auf
  „von Hand“.
- **Allgemein:** Name, Beschreibung, Konversion (bis 3b „Maische-Effizienz“, Vorgabe 80 %), Abkühlschwund
  (Vorgabe 4 %), Läutereffizienz für Fly Sparge (optionaler Festwert). Siehe Rezept › Effizienz.
- **Behälter:** Name, Volumen, Totraum (Behälterverlust, z. B. ohne Bodenablauf) und die Schritte, die er
  übernimmt. Eine Art (HLT, Maischbottich/-pfanne, Läuterbottich, Würzepfanne, All-in-One,
  Zwischenbehälter …) hakt die Schritte nur vor und wird nicht gespeichert; das Auswahlfeld zeigt die Art,
  die zu den angehakten Schritten passt, sonst „eigene Zusammenstellung“. Die Bezeichnung ergibt sich aus
  den Schritten („…pfanne“, wenn der Behälter beim Maischen direkt beheizt ist, sonst „…bottich“).
  Verdampfung in l/h gibt es nur am Kochbehälter (das Rezept kann sie überschreiben), die
  Läutermethode (Senkboden, Sack, Malzkorb …) nur am Läuterbehälter, rein beschreibend. Ebenfalls nur am
  Läuterbehälter steht der **Treberverlust** in l/kg (fehlt er, gilt 0,96 wie bei Brewfather, Literatur 0,8–1,0;
  Vorlagen: Sack 0,6, Malzrohr 0,8, Senkboden 0,96), den das Rezept überschreiben kann.
- **Geräte:** Heizquellen, Pumpen, Rührwerke, Ventile (nur Wasserzulauf), Spiralen, Kühler und
  Kondensatoren. Jedes hat einen Ort (Behälter oder inline) und ist **„von Hand“ oder „angeschlossen“**.
  Angeschlossen braucht es eine Registry-Verknüpfung: Heizquelle → Regler oder Aktor, alle anderen → Aktor.
  Bei Kühler, Kondensator und Spirale ist der Aktor das Kühlwasserventil, eine Kette Kühler → Ventil gibt
  es nicht. Kühler haben eine Bauart (Eintauch, Platte, Gegenstrom, Eisbad, No-Chill).
  - Die **HERMS-Spirale** ist ein Gerät, keine Eigenschaft des Behälters: beim Maischen Wärmetauscher, beim
    Kühlen auch als fest verbauter Eintauchkühler wählbar.
  - Ein **Dampfkondensator** am Kochbehälter verlangt eine reduzierte Heizleistung beim Kochen.
- **Heizung je Schritt:** direkt oder indirekt. Indirekt heißt, die Heizquelle sitzt in einem anderen
  Behälter oder inline: „indirekt über Spirale im HLT“ (HERMS), „indirekt über Würzepfanne“ (Kettle-RIMS)
  oder „indirekt über RIMS-Rohr“. Diese drei brauchen eine Umwälzpumpe. Umwälzen geht auch im
  Ein-Kessel (Malzrohr), statt Umwälzen auch ein Rührwerk.
  - **Maischen braucht immer eine Heizquelle.** Wer per Aufguss maischt, legt die Wasserquelle als Behälter
    mit Heizquelle an, notfalls den Wasserkocher (Entscheidung 2026-10-05). Sitzt die Heizquelle beim
    Maischen in einem anderen Behälter ohne Spirale und ist keine Umwälzpumpe gewählt, ist das Verfahren
    **Aufguss** („Aufguss aus Wasserkocher“), kein Fehler. In allen anderen Schritten bleibt eine
    Heizquelle in einem anderen Behälter ohne Pumpe ein Fehler.
  - Kühlen beim Maischen braucht kein Gerät: Es geschieht durch Zubrühen von kaltem Wasser oder Eis
    (siehe Maischeplan).
- **Prozessschritte:** je Schritt Heizquelle, Umwälzpumpe, Rührwerk, Wasserzulauf und Heizrate; Kochen
  zusätzlich Kondensator und Heizleistung in %, Kühlen den Kühler (auch eine Spirale im Kühlbehälter) und
  die angenommene Kühldauer für die spätere IBU-Rechnung. Vorbelegt wird nur einmal, beim Zuordnen eines
  Schritts bzw. beim Anlegen eines Geräts: Rührwerk am Behälter beim Maischen, Kondensator am Kochbehälter
  beim Kochen.
- **Transfers:** von → nach (inkl. Ausschlagen), Schritt, Antrieb (Pumpe, Schwerkraft, von Hand). Ein
  Verlust zählt nur bei Pumpe; „kommt im nächsten Schritt zurück“ markiert, dass das Restvolumen wieder
  eingebracht wird.
- **Messungen gibt der Prozess vor**, nicht das Sudhaus: eine feste Liste je Schritt (Malz- und
  Leitungswassertemperatur, Haupt- und Nachgussmenge, Temperaturen, pH, Vorderwürze, Pfannevoll, Stammwürze
  und pH vor und nach dem Kochen, Luftdruck, Ausschlagmenge, Anstelltemperatur). Das Sudhaus verknüpft jede mit einem Sensor oder
  lässt sie „von Hand“ (Vorgabe); dann zeigt der Sud ein Eingabefeld und speichert den Wert.
- **Prüfung:** Fehler sperren das Speichern (leerer Name, Pflichtschritt ohne Behälter, Verweis auf
  Gelöschtes, Maischen/Kochen ohne Heizquelle, indirekt ohne Pumpe außer Aufguss, Pumpentransfer ohne Pumpe,
  angeschlossen ohne Verknüpfung). Hinweise sperren nicht (Registry-ID fehlt im Snapshot, Kondensator bei
  100 %, Kühlen ohne Kühler, Sensor-Einheit passt nicht zur Messung). Ein gelöschter Behälter nimmt den Ort
  seiner Geräte nicht mit, damit eine Heizquelle nicht stillschweigend zum RIMS-Rohr wird; die Prüfung
  meldet die Lücke.
- **Editor in Tabs** (Mockup: <https://claude.ai/artifact/FTzMBuDbcCZaksoJAXrASH>): Übersicht · Behälter ·
  Geräte · Schritte · Transfers · Messungen, jeder Tab mit Anzahl und Fehlerzahl. Die **Übersicht** trägt
  Allgemein, Prüfung und das **Anlagenschema**: Behälter als Karten in Prozessreihenfolge (nach ihrem
  ersten Schritt), darin Volumen, Totraum, Schritte, indirekte Heizung und die Geräte mit „angeschlossen“
  bzw. „von Hand“; Transfers als Pfeile (gleiche Strecke und gleicher Antrieb zusammengefasst), Umwälzung
  gestrichelt, ein ausgeschlagener Sud endet im Gärkeller. Jeder Teil springt beim Klick in den Tab, in dem
  man ihn bearbeitet; ebenso die Einträge der Prüfung. Die Seite hat die übliche Breite der Einstellungen,
  nur das Schema reicht rechts bis an den Fensterrand und scrollt links über die Spalte hinaus. Wie in den
  Einstellungen steht eine kleine Gruppenüberschrift über den Karten, jeder Behälter, jedes Gerät, jeder
  Schritt, Transfer und jede Messung ist eine eigene Karte.
- **Prozessverluste nach dem Kochen gehören nicht zur Anlage** (Hopfen, Hefetrub, Kalthopfung), siehe
  Gärung › Abfüllmenge. Der Treberverlust ist eine Vorgabe am Läuterbehälter (siehe Wasser).

### Gärkeller
Umgesetzt seit 2026-10-12 (`web/src/cellar.ts`, `pages/CellarSection.tsx`, `/api/fermenters`,
`/api/containers`), nur auf SD-Boards und im Paket `recipes`: Gärplätze und Gebinde. Der Belegungsplan über
mehrere Wochen (belegt, frei, reserviert für geplante Sude) kommt mit dem Sud, weil er dessen Daten braucht.

- **Ablage:** zwei Sammlungen, je Objekt eine Datei auf der SD (`/fermenters/<id>.json`,
  `/containers/<id>.json`, ohne Index, `JsonDocDir`), wie die Sudhäuser. Eigene Objekte statt Teil der
  Brauerei: `brewery.json` trägt Standortwerte und Wasserprofile, wird von jedem Rezept beim Rechnen geladen
  und teilt sich mit ihnen das Body-Limit von 16 KB. Pro Objekt eine Datei vermeidet zudem, dass zwei Browser
  einander überschreiben. Die Firmware prüft nur die `id`, neue Felder kommen optional dazu, es gibt keine
  Schemaversion. Der Gärplatz hält **keine Belegung**: Sie steht im Sud (`fermenterId`, belegt ab/bis) und
  in dessen Index-Zeile (Entscheidung 2026-10-12, statt einer eigenen Sammlung `/bookings`); der Sud kopiert
  den Gärplatz wie das Sudhaus beim Start.
- **Gärplatz:** Name, Bauart (Eimer/Fass, Glasballon, Edelstahl konisch, Druckgärtank, Keg, Sonstiges;
  beschreibend), Volumen, Trubverlust (leer = die Annahme des Rezepts gilt), druckfest bis (bar Überdruck,
  leer = nicht druckfest) und Temperierung: ohne, kühlen, heizen, kühlen und heizen. Ist sie nicht „ohne“,
  steht die Steuerung auf „von Hand“ (Vorgabe) oder „angeschlossen“; angeschlossen braucht einen **Regler
  oder Aktor**, wie die Heizquelle im Sudhaus. Ein **Temperaturfühler** ist immer wählbar, auch für einen
  Gärplatz nur mit Thermometer. „Ohne Temperierung“ verwirft Regler und Aktor, der Fühler bleibt. Die
  **Umgebungstemperatur** (`ambientTempC`, seit 5c-2) ist die Temperatur dort, wo der Behälter steht; leer =
  unbekannt. Ein Gärplatz ist ein Behälter mit seiner Temperierung, kein Ort, deshalb steht sie am Gärplatz
  und nicht an der Brauerei (Entscheidung 2026-10-14). Ein
  **Dichtesensor** (`densitySensor`, seit 5c-4; z. B. iSpindel als Remote-Sensor) ist ein eigenes Feld; misst er
  nicht in °P, SG oder °Bx, steht ein Hinweis, und der Gärverlauf lässt ihn aus.
- **Gerät auf einem anderen Board:** Remote-Sensoren und -Aktoren sind lokale Proxys und stehen im Snapshot
  wie lokale Items; die Verknüpfung trägt sie ohne Änderung. Einen **Remote-Regler gibt es nicht**
  (`Discovery.h`: „no remote controller proxy exists“), ein Regler, der nur auf dem anderen Board läuft,
  lässt sich nicht verknüpfen. Ausweg: dort einen Remote-Sensor und -Aktor anlegen, der Regler läuft auf dem
  Board mit der Brauanlage (`DynamicItems` baut Regler über `findSensor`/`findActuator`). Der Editor sagt
  das am Feld. Ein Remote-Regler-Proxy in der Library steht in PLAN.md.
- **Gebinde:** Flasche oder Keg, Größe in l, Anzahl (vorhandene Stückzahl, wird nicht geprüft),
  Abfüllverlust je Füllung (leer = 0), druckfest bis. Ohne Namen heißt es „Flasche 0,5 l“ bzw. „Keg 19 l“.
  Die Abfüllmenge im Gärung-Tab liest Größe und Abfüllverlust später.
- **Prüfung:** *Fehler sperren das Speichern:* Gärplatz ohne Namen, Volumen ≤ 0, Trubverlust negativ oder
  nicht kleiner als das Volumen, negativer Druck, „angeschlossen“ ohne Regler oder Aktor; Gebinde mit
  Größe ≤ 0, Anzahl keine ganze Zahl ab 0, Abfüllverlust negativ oder nicht kleiner als die Größe, negativem
  Druck. *Hinweise sperren nicht:* Regler, Aktor oder Fühler fehlt im Snapshot; Fühler oder Reglereingang misst
  nicht in °C; Keg ohne Druckangabe; Anzahl 0. Querbezüge zum Rezept („Rezept verlangt Druck, Gärplatz ist
  nicht druckfest“) gehören zum Sud.
- **Editor:** Abschnitt „Gärkeller“ auf der Seite Brauanlage unter den Sudhäusern, getrennt in Gärplätze und
  Gebinde. Jedes Objekt wird in einem Dialog bearbeitet und für sich gespeichert (flaches Objekt, daher kein
  eigener Editor mit Tabs); Prüfung und Hinweise stehen im Dialog.
- **Backup:** `/fermenters` und `/containers` liegen wie `/brewhouses` außerhalb von `/config` und sind nicht
  im Backup; sie kommen gemeinsam mit den übrigen Dokumenten der Brauanlage in einen Export (PLAN.md).

## Sud

**Etappen** (Entscheidung 2026-10-12): **5a Gerüst** (umgesetzt, Stand unten), **5b Brautag** (Vorbereitung,
Maischen, Würzekochen mit Soll/Ist-Messwerten, Abhaken, Kochtimer), **5c Gärung, Reifung, Abfüllung** mit
Belegungsplan.

**Stand 5a (2026-10-12, `web/src/brews.ts`, `brewStart.ts`, `pages/BrewsPage.tsx`, `pages/BrewPage.tsx`):**
- **Ablage:** eine Datei je Sud, `/brews/<id>.json`, mit Index `/brews/index.jsonl` wie die Rezepte
  (`/api/brews`, nur SD-Boards; `RecipeStore` mit Verzeichnis-Parameter). Die Index-Zeile (`brewSummaryLine`)
  trägt Nr., Name, Rezeptversion, Status, Brautag, Gärplatz und belegt ab/bis. Der Belegungsplan (5c) liest
  nur die Liste. Weil die Firmware die Index-Felder festlegt, stehen sie schon jetzt vollständig drin.
- **Status:** geplant → läuft (Brautag gestartet) → abgeschlossen. Bis zum Start rechnet der Sud mit dem
  aktuellen Sudhaus, Gärplatz und Katalog.
- **Anlegen** nur aus einem fertigen, gespeicherten Rezept (Tab „Sude“). Nr. = höchste + 1, Name = Rezept,
  Brautag heute, Sudhaus aus dem Rezept, belegt ab Brautag für die Summe der Gärphasen. Ein neuer Brautag
  verschiebt den Zeitraum mit; überschneidet er sich mit einem anderen Sud auf demselben Gärplatz, steht ein
  Hinweis im Kopf.
- **Brautag starten** („⋯“, nur gespeichert): Der Dialog zeigt je Lagerposten der Rezeptzeilen
  (`stockLotId`) Menge und Bestand, jede Zeile lässt sich abwählen. Abgebucht wird höchstens bis 0, der Sud
  merkt sich die tatsächlich abgezogene Menge (`booked`). Dann kopiert er Sudhaus, Brauerei, Gärplatz und
  die Einträge seiner Zutaten (`frozen`, ohne Beschreibungstexte; Lagerposten mit ihren Werten, `entryOf`
  arbeitet direkt auf der Kopie). Bricht der Start ab, bleibt das schon Abgebuchte vermerkt und wird beim
  nächsten Versuch nicht doppelt gebucht.
- **Rezept:** Der Sud verweist auf die Version, kopiert sie aber nicht. Eine Version mit Suden legt beim
  Speichern eine neue Version (Entwurf) an und lässt sich nicht löschen; ein Rezept, aus dem Sude angelegt
  wurden, ebenso nicht. Das Auswahlfeld der Versionen nennt die Sude je Version.
- **Löschen:** Mit Abbuchungen bietet die Rückfrage „Löschen und Lager zurückbuchen“; die Mengen gehen an
  die Posten zurück, die es noch gibt.
- **Kopf:** Name, Rezeptversion (Link), Brautag, Sudhaus, Gärplatz, belegt ab/bis, Notizen; nach dem Start
  zeigen Sudhaus und Gärplatz die Kopie. Die Phasen-Tabs sind angelegt und noch leer.
- **Sicherung:** eigener Export/Import auf „Backup & Restore“ (`brewcontrol-brews`); der Lagerbestand
  bleibt dabei unverändert.
- **Größe:** Die Kopien brauchen einige KB von 16 KB je Dokument. Messreihen der Gärung (5c) gehören nicht
  ins Sud-Dokument.

**Stand 5b-1 (2026-10-13, `web/src/brewDay.ts`, `pages/brew/PrepTab.tsx`, `pages/brew/MeasureRow.tsx`):**
- **Sollwerte** (`brewTargets`) aus der Kette der Rezept-Tabs auf den Kopien des Suds, vor dem Start auf den
  aktuellen Objekten. Gerechnet wird mit dem Sudhaus des Suds, auch wenn das Rezept ein anderes nennt.
  - Haupt- und Nachguss: Einfüllmenge (`strikeFillL`/`spargeFillL`, mit Totraum und Leitung), darunter
    die Menge in die Maische bzw. zum Läutern. Temperatur: Hauptguss aus dem Maischeplan, Nachguss aus dem
    Rezept. pH aus der Aufbereitung.
  - **Neuer Messwert `strikeTemp`** (Hauptgusstemperatur) im Sudhaus, mit einem Fühler verknüpfbar.
  - **Stammwürze vor dem Kochen** ist neu: der Extrakt ohne Kochzucker in Pfannevoll (abzüglich
    Kühlschwund). `wortExtract` gibt dafür Grist und den Kochzucker-Extrakt (`boilOtherKg`) zurück.
  - Ausschlag und Stammwürze nach dem Kochen: Pfanneninhalt **vor** einem Verschnitt in der Pfanne.
  - Vorderwürze (für 5b-2): aus der Rezept-Konversion nach Troesters Mash Gravity Test,
    °P = 100·D/(D+W) mit D = gelöster Extrakt und W = Maischwasser (Hauptguss mit Zubrühen, abzüglich
    Verdampfung beim Maischen). Die Malzfeuchte zählt nicht (`TODO(verify)`).
- **Effizienzen rückwärts** (`measuredEfficiency`): genau die Umkehrung der Vorwärtskette. Pfannevoll und
  Vorkoch-°P zählen vor Ausschlag und Stammwürze nach dem Kochen. Ein Sud mit Ist = Soll ergibt die
  Rezept-Effizienzen (Test). Die Gesamteffizienz braucht die Anstellwürze und kommt mit 5c.
- **Abweichung** (`deviation`): Toleranzen als Annahme in `TOLERANCE`: °P ±0,2, Volumen ±2,5 %,
  pH ±0,1, °C ±1 K, Effizienz ±2 Punkte.
- **Speichern:** Messwerte, Haken und Ist-Mengen speichern beim Bestätigen (Enter oder Feld verlassen) über
  `patchBrew`: Sud frisch laden, ein Feld setzen, `PUT`. Auch „Speichern“ im Kopf schreibt nur die
  Kopf-Felder (`HEAD_FIELDS`, dazu die Notizen je Phase) auf eine frische Kopie. Zwei Geräte am Brautag
  überschreiben sich so nur, wenn sie zur selben Zeit dasselbe Feld ändern.
- **Sensor oder Hand:** Ist die Messung im Sudhaus mit einem Fühler verknüpft, zeigt die Zeile dessen
  Live-Wert mit „übernehmen“ (gespeichert mit `src`); das Eingabefeld bleibt daneben. Stammwürze in
  °P, SG oder °Bx, gespeichert in °P. Bis zum Start sind die Felder gesperrt, die Sollwerte sichtbar.
- **Vorbereitung:** Wasser je Haupt- und Nachguss mit den Dosen der Aufbereitung (Hauptguss, Maische außer
  „nach pH-Messung“, Nachguss) zum Abhaken. Die Zutaten stehen nach Art, nicht nach Prozessschritt, und
  sind je Zutat und Lagerposten zusammengefasst. Die Gruppe hat Soll-Summe, Bestand und Haken. Bei mehreren
  Gaben stehen diese eingerückt darunter, jede mit ihrer Ist-Menge (`rowAmounts` je Rezeptzeile).
- **Lager:** Eine geänderte Ist-Menge bucht die Differenz am Posten nach oder zurück (`rebook`, höchstens
  bis 0) und führt `booked` nach. Ein Posten, der beim Start abgewählt wurde, wird nicht nachgebucht.
  Warnung vor dem Start: Bestand reicht nicht; danach: nur ein Teil wurde abgebucht.
- **Größe:** Ein großer Sud (29 Rezeptzeilen, alle Messwerte, Haken, Ist-Mengen, Notiz) hat nach dem Start
  9,5 KB. Messwerte, Haken und Ist-Mengen tragen dazu etwa 3–4 KB bei, die Kopie des Sudhauses gut 2 KB,
  jede eingefrorene Zutat etwa 0,4 KB.

**Stand 5b-2 (2026-10-13, `web/src/brewPrograms.ts`, `brewDay.ts`, `pages/brew/MashTab.tsx`, Firmware
`ProgramEvents.h`):**
- **pH und Säure in drei Schritten:** „pH Maische“ (nach dem Einmaischen), die Säure, „pH nach der Säure“
  (`mashPhAcid`).
  - **Soll:** „pH Maische“ ist der Modell-pH **vor** der Gabe „Maische nach pH-Messung“ (5b-1 hatte den nach
    ihr gesetzt, aber nicht angezeigt). „pH nach der Säure“ ist der Ziel-pH der Maische aus dem Rezept
    (ohne Eingabe 5,4). Beide Zeilen bieten den Wert des pH-Fühlers an.
  - **Vorschlag** (`mashAcidSuggestion`): die Säurehilfe des Rezepts (`suggestAgent`) auf der Mash-Spalte,
    deren pH am Messwert verankert ist. Das geht über `diPh = gemessen − mashPh(0, R, Maische vor der Gabe)`,
    weil das Modell den Schüttungs-pH nur addiert; die Wirkung der Säure (Wasser und Malzpufferung) bleibt
    die des Modells. Damit gibt es den Vorschlag **auch unter Kolbach** (Entscheidung 2026-10-13); Malzdaten
    braucht er nicht, nur das Hauptguss-Verhältnis. Liegt der pH unter dem Ziel, schlägt er eine Base vor
    (Natron).
  - **Ist-Menge** je Rezeptzeile „Maische nach pH-Messung“, gebucht wie jede Zutat (`rowAmounts`,
    `rebook`). Gibt das Rezept das vorgeschlagene Mittel nicht her, steht seine Menge unter
    `rowAmounts['mashPh:<Katalog-ID>']`, ohne Lagerbuchung. „übernehmen“ setzt die Ist-Menge auf den
    Vorschlag (auf 0,1 gerundet). Das vorgeschlagene Mittel kommt aus dem heutigen Katalog, weil die Kopie
    des Suds nur die Zutaten des Rezepts enthält.
- **Vorderwürze:** Messwert mit Soll aus 5b-1, darunter die Konversion Ist (`measuredEfficiency`) gegen
  Soll mit Abweichung.
- **Rasten** gibt es nur **ohne Regelung**: Die Heizquelle beim Maischen ist „von Hand“ oder hat keinen
  Regler (`isRegulated`). Sonst steht dort nur ein Satz; den Verlauf zeigt das Diagramm (Stand 5b-4). Seit
  Stand 5b-5 steht dort das Maischprogramm, das den Regler stellt.
  - **Tabelle:** jede Zeile des Maischeplans außer Wasser vorlegen, mit Soll-Temperatur, Dauer, Übergang und
    Ist-Temperatur (`restTemps` je Schritt-ID, mit dem Wert des Maischefühlers).
  - **Timer** (`mashTimerProgram`): „Maischen starten“ legt ein Programm „Sud #n Maischen“ auf dem Gerät an
    und startet es (`brew.mashProgramId`). Die Schritte schalten nichts (`targets: {}`):
    - je Handgriff ein Schritt, der auf „Weiter“ wartet (`confirm`): Hauptguss heizen, Einmaischen (mit
      Schüttung nur bei mehreren), Zubrühen, Eis, Dekoktion;
    - je Temperaturwechsel „Aufheizen/Abkühlen auf T“: ohne Fühler mit `confirm`, mit verknüpftem Fühler
      (Hauptgusstemperatur bzw. Maischetemperatur, der in der Registry stehen muss) endet er von selbst bei
      T ∓ 0,5 K (`REACHED_MARGIN_K`, Annahme; die Schwelle ist auf 0,1 K gerundet) und meldet sich per
      `notify` (Entscheidung 2026-10-13);
    - je Rast „Rast T °C · m min“ mit der Haltezeit; nach einem Fühler-Ende meldet auch sie sich.
    - Das Ende der letzten Rast meldet die Firmware als „Programm fertig“.
  - **Anzeige:** die Programm-Karte des Dashboards (`ProgramCard`, Entscheidung 2026-10-13), Abfrage jede
    Sekunde bei offenem Tab. Dazu „Timer abbrechen“ (mit Rückfrage) bzw. „Timer entfernen“; die Karte selbst
    kann neu starten. Fehlt das Programm auf dem Gerät, bietet der Tab wieder „Maischen starten“ an.
  - **Aufräumen:** „Abschließen“ und „Löschen“ des Suds löschen das Programm (Entscheidung 2026-10-13).
- **Firmware:** Schritt-Flag `notify` (meldet beim ersten Betreten eines Schritts, nach derselben Regel wie
  die Impulse: nicht nach „Zurück“ und „Weiter“, nicht nach einem Neustart; die Uhr läuft weiter). Meldungen
  `awaiting` und `notify` tragen den Schrittnamen (`Alert.step`, 39 Byte); der Push lautet „{Programm}:
  {Schritt}“ bzw. bei `notify` Titel = Programm, Text = Schritt. Der Push-Tag bleibt `program/<id>`, eine
  Meldung ersetzt die vorige. Der Programm-Editor kennt `notify` als „Melden“, die Karte zeigt 🔔.
- **Größe:** Der Mock-Sud nach dem Durchspielen (3 Zutaten, drei Messwerte, eine Rast) hat 3,8 KB; je
  Rast-Ist-Temperatur kommen etwa 50 Byte dazu.

**Stand 5b-3 (2026-10-13, `web/src/brewPrograms.ts`, `brewDay.ts`, `pages/brew/BoilTab.tsx`, `BrewTimer.tsx`,
`pages/recipe/BrewsTab.tsx`, `EfficiencyChart.tsx`, Firmware `RecipeFiles.h`, `ProgramEvents.h`):**
- **Zeitfeld für alle Kochgaben** (Entscheidung 2026-10-13): „min vor Kochende“ gibt es im Rezept für jede
  Zeile mit Zeitpunkt „Kochen“, nicht nur für Hopfen (Kochzucker, Irish Moss). Ohne Angabe gilt die ganze
  Kochzeit. Die Bittere rechnet weiter nur mit Hopfen.
- **Gaben** (`boilAdditions`): alle Zeilen mit Zeitpunkt Vorderwürze, Kochen, Whirlpool, Hop Back, Kettle
  Sour und Dip, in dieser Reihenfolge, beim Kochen die längste Zeit zuerst. Eine Zeit über der Kochdauer
  zählt als Kochbeginn. Eine Quelle für die Liste im Tab und für das Programm.
- **Kochtimer** (`boilTimerProgram`): „Kochen starten“ legt das Programm „Sud #n Kochen“ an und startet es
  (`brew.boilProgramId`); gedrückt wird **beim Anheizen** (Entscheidung 2026-10-13). Die Schritte schalten
  nichts:
  - „Vorderwürze: … zugeben“ (nur mit Vorderwürze-Gaben) und „Aufheizen – Weiter bei Kochbeginn“ warten auf
    „Weiter“ (`confirm`).
  - Je Zeitpunkt mit Gaben ein Schritt „Noch 10 min: 20 g Citra, 15 g Saaz zugeben“ mit der Zeit bis zum
    nächsten Zeitpunkt als Haltezeit; gleiche Zeit ergibt **einen** Schritt. Er meldet sich per `notify` und
    hält die Uhr nicht an, eine späte Quittung verschiebt also nichts. Der erste Schritt nach „Weiter“ meldet
    nicht; ohne Gabe bei voller Kochzeit heißt er „Kochen · 60 min“.
  - „Kochende: Heizung aus“ (mit den Gaben bei 0 min) wartet auf „Weiter“.
  - **Whirlpool** (Entscheidung 2026-10-13): mit Whirlpool-Gaben „Auf 80 °C kühlen, … zugeben“ (`confirm`),
    dann „Whirlpool · 15 min“ als Haltezeit. Die Whirlpool-Zeit läuft auch ohne Gabe (Annahme); ihr Ende
    meldet die Firmware als „Programm fertig“.
  - Die Menge im Schritt ist die Ist-Menge, wenn sie beim Start schon eingetragen ist.
  - Hop Back, Kettle Sour und Dip stehen nur in der Liste.
- **Kopfzeile** (`boilProgress`): über der Programm-Karte „Kochende in 38:12 · in 11:48: 20 g Citra zugeben“
  bzw. „Wartet auf Weiter: …“; im Whirlpool „Whirlpool-Ende in …“. Abfrage jede Sekunde wie beim Maischen.
- **Timer-Komponente:** Der Rasten-Timer aus 5b-2 und der Kochtimer teilen sich `BrewTimer` (anlegen,
  starten, Karte, abbrechen/entfernen mit Rückfrage). „Abschließen“ und „Löschen“ des Suds löschen beide
  Programme.
- **Gaben-Liste:** je Gabe Haken, Zeit, Rezeptmenge und Ist-Menge (bucht über `rebook`). Der Haken merkt
  sich die Uhrzeit (`brew.addedAt` je Rezeptzeile) und zeigt „zugegeben 10:21“. Das Programm hakt nichts ab.
- **Messwerte:** vor dem Kochen pH, Pfannevoll, Stammwürze und die **Maischeeffizienz** (Soll/Ist), nach dem
  Kochen pH, Ausschlagmenge, Stammwürze, Luftdruck und die **Sudhausausbeute**. Darunter steht, aus welchem
  Wertepaar die Effizienzen kommen (`measuredEfficiency().from`).
  - Ein Soll für den **pH der Würze** gibt es nur, wenn das Rezept dort etwas zugibt („Würze vor dem
    Kochen“, „Ausschlagwürze“); diese Dosen stehen zum Abhaken dabei.
  - **Luftdruck:** Soll aus der Höhe der Brauerei; der Messwert ergibt den Siedepunkt, der unter der Zeile
    neben dem aus der Höhe steht.
- **Würze abzweigen:** Speise und Würze für Dip Hopping als Messwerte `speiseVolume`/`dipWortVolume`, nur
  Ist; den Soll bringt 5c.
- **Ergebnisse im Index** (`withResults`): Jedes Speichern des Suds schreibt `ogPlato` (Soll) und
  `ogActual` (Ist) der Stammwürze nach dem Kochen sowie `mashEffPct` und `yieldPct` (Ist) ins Sud-Dokument,
  auf zwei Stellen gerundet; die Firmware nimmt sie mit `bottledL` (für 5c) in die Index-Zeile auf. Bei einem
  Verschnitt ist das die Stammwürze **vor** dem Verschnitt (Annahme); 5c stellt auf die Anstellwürze um.
  Sude, die vor dem Firmware-Update gespeichert wurden, bekommen die Felder beim nächsten Speichern.
- **Rezept-Tab „Sude“:** Spalten Stammwürze Soll / Ist, Maischeeffizienz, Sudhausausbeute; ab zwei Suden mit
  Werten das Diagramm „Effizienz über die Sude“ (uPlot, x = Sude in Reihenfolge ihrer Nummer). Die
  Kennzahlen-Kacheln und die Soll-Linie aus dem Canvas fehlen: Die Index-Zeile trägt keine Soll-Effizienz.
- **Speichern nacheinander:** Die Sud-Seite reiht ihre Feld-Speicherungen auf. Vorher konnten zwei schnell
  gesetzte Haken (drei Gaben zur selben Minute) einander überschreiben, weil jede Speicherung den Sud frisch
  liest. Zwischen zwei Geräten gilt weiter die Regel aus 5b-1.
- **Firmware:** Ein Text, der länger ist als sein Feld in der Meldung (Schrittname 39 Byte), wird an einer
  Zeichengrenze abgeschnitten (`utf8PrefixLen`); vorher konnte der Schnitt mitten in „ü“ oder „°“ liegen.
  Mehrere Gaben in einem Schritt passen nicht in 39 Byte: Meldung und Push enden dann nach der ersten oder
  zweiten Gabe, die Karte zeigt den vollen Namen.
- **Größe:** Der Mock-Sud (12 Rezeptzeilen, 8 Messwerte, 3 Haken mit Uhrzeit, eine Ist-Menge) hat 5,7 KB;
  je Haken mit Uhrzeit kommen etwa 20 Byte dazu, die Ergebnisfelder zusammen etwa 70 Byte.

**Stand 5b-4 (2026-10-13, `web/src/pages/brew/MashCourse.tsx`, `DeviceList.tsx`, `web/src/brewDevices.ts`; nur
Web, Firmware unverändert):**
- **Verlauf** (Karte oben im Tab Maischen, in **jedem** Sud mit Maischeplan, Entscheidung 2026-10-13): der
  Maischeplan gegen die Temperatur aus einem Gerätelog.
  - **Mit Regelung** steht das Diagramm mit Heizleistung da; Rasten-Tabelle und Programm-Karte gibt es dort
    nicht, die Rasten stellt man am Regler (seit Stand 5b-5 fährt sie ein Programm). **Von Hand** bleiben
    Timer und Rasten-Tabelle aus 5b-2, das Diagramm kommt dazu.
  - **Zeitanker ist das Einmaischen** (Entscheidung 2026-10-13): „Eingemaischt“ setzt `phaseStartedAt.mash`
    auf jetzt, das Feld „Eingemaischt um“ korrigiert die Zeit (beim Verlassen gespeichert, geleert nimmt es
    den Anker wieder weg). Der erste Einmaisch-Schritt des Plans liegt auf dieser Zeit, das Heizen des
    Hauptgusses links davon (`sollCourse`). Ohne Anker gibt es kein Diagramm.
  - **Log:** vorgeschlagen ist das erste Log, das den Maischefühler aufzeichnet (Messung
    „Maischetemperatur“ des Sudhauses, `pickLog`); der Sud merkt sich die Wahl in `logId`, spätestens mit
    dem Anker. Enthält kein Log den Fühler, steht ein Hinweis (kein Anlegen aus dem Sud heraus).
  - **Ist:** die Spalte des Fühlers aus der Log-Session, die vor dem Ende des Verlaufs begann
    (`sessionFor`: die laufende am Brautag, eine archivierte bei einem alten Sud), von 15 min vor dem Plan
    bis 30 min danach. Solange der Sud läuft, kommt alle 5 s ein Punkt aus dem Live-Snapshot dazu.
  - **Heizleistung:** der Aktor des Reglers der Maisch-Heizquelle (`params.actuator` bzw. `heatActuator`),
    ohne Regler der Aktor der Heizquelle, in Prozent seines Bereichs (`outputPct`). Sie kommt aus dem Log,
    wenn es den Aktor aufzeichnet; sonst nur live bei offener Seite, mit Hinweis.
  - **Legende:** Soll, Ist und Heizleistung an der Cursor-Position; der Soll wird zwischen den Eckpunkten
    des Plans linear gelesen.
- **Pumpen & Geräte** (Karte in den Tabs Maischen und Würzekochen): **eine Zeile je Gerät**, nicht je
  Transfer (Entscheidung 2026-10-13), mit dem, wofür es gebraucht wird („Hauptguss HLT → MLT“, „Umwälzung
  Maischen“).
  - **Welche:** die Pumpen der Transfers mit Antrieb „Pumpe“ und die Geräte der Schritte (Umwälzpumpe,
    Rührwerk, Ventile, Kühler oder Spirale, Kondensator), nur mit verknüpftem Aktor. Geräte „von Hand“ und
    die Heizquelle fehlen; die Heizquelle bleibt beim Regler.
  - **Tabs:** Maischen zeigt Hauptguss bereiten, Maischen, Läutern und Nachguss; Würzekochen zeigt Nachguss,
    Läutern, Kochen, Whirlpool, Hop Back und Kühlen. Läutern und Nachguss stehen also in beiden.
  - **Schalten:** der Hauptschalter des Aktors (`enableActuator`), weil ein Binary-Aktor keinen anderen hat.
    Ein stufenloser Aktor, der auf seinem Minimum steht, wird beim Einschalten auf sein Maximum gesetzt
    (Annahme). Daneben der Zustand aus dem Snapshot (an/aus oder Prozent). Läuft der Aktor im Intervall
    (z. B. 4 von 5 s), steht dort sein Sollwert und nicht der Momentanwert, der in jeder Pause auf 0 fiele.
  - **Sperre:** Gehört der Aktor einem eingeschalteten Regler oder einem laufenden Programm
    (`ownership.ts`), ist der Schalter gesperrt und nennt den Besitzer. Das Dashboard fragt in dem Fall nach,
    der Sud nicht. Gesperrt ist er auch, solange der Sud nicht läuft, und bei eingerastetem Not-Aus (seit
    2026-10-14; die Firmware würde die Freigabe annehmen, PLAN.md).
  - **Laufzeit und Menge** hält der Sud nicht fest (Entscheidung 2026-10-13): Die Mengen stehen als
    Messwerte im Sud, und Durchfluss × Laufzeit wäre nur eine grobe Schätzung. `transfers` aus dem Plan gibt
    es deshalb nicht.
- **Nicht gebaut:** die Tabelle „Maischeplan“ aus dem Canvas mit Ist-Mittelwert und Ist-Dauer je Rast.
- **Größe:** `logId` und `phaseStartedAt` kosten zusammen etwa 60 Byte (Mock-Sud 4,5 KB).
- **Am Gerät geprüft (LilyGo, 2026-10-14):** 5b-1 bis 5b-4 mit einem Prüfrezept, dessen Timer in Minuten
  laufen (SESSION.md). Die Testdaten liegen auf dem Board: Rezept „Gerätetest“, Sudhäuser „Gerätetest von
  Hand“ und „Gerätetest geregelt“, Sude #2 und #3.

**Stand 5b-5 (2026-10-14, `web/src/brewPrograms.ts`, `pages/brew/MashTab.tsx`, `BrewTimer.tsx`,
`MashCourse.tsx`, Firmware `ProgramRunner.cpp`):** das Maischprogramm für geregelte Maischen. Alle Punkte
sind Entscheidungen des Nutzers vom 2026-10-14, wo nicht anders vermerkt.
- **Wann:** Die Heizquelle des Schritts „Maischen“ hängt an einem Regler (`isRegulated`). „Maischen starten“
  legt dann wie von Hand das Programm „Sud #n Maischen“ an, nur stellt es dem Regler die Sollwerte. Die
  Karte „Rasten“ zeigt dort die Programm-Karte; die Rasten-Tabelle mit Ist-Temperaturen bleibt dem Maischen
  von Hand vorbehalten.
  - **Nicht bei Aufguss** (Heizquelle in einem anderen Behälter, ohne Spirale und Pumpe): Dort hält der
    Regler das Wasser heiß und nicht die Maische. Solche Sudhäuser bekommen den Rasten-Timer von Hand
    (vorher stand dort der Satz „Die Rasten stellst du am Regler“).
- **Was das Programm stellt** (`mashControlOf`): nur Regler, keine Pumpe und kein Rührwerk. Die bleiben in
  „Pumpen & Geräte“ frei schaltbar, weil ein Aktor, den ein Programm anspricht, dort gesperrt wäre. Braucht
  die Heizung die Umwälzpumpe (HERMS, RIMS; `needsPump`), steht ein Hinweis über dem Startknopf.
- **Ein Generator** für beide Fälle: `mashTimerProgram(…, control?)`. Ohne `control` ist es der
  Rasten-Timer aus 5b-2, unverändert.
- **Sollwerte:** auf 0,1 K gerundet, jeder mit `enabled: true`.
  - **Aufheizen/Abkühlen auf T** setzen den Sollwert beim Beginn und enden am Fühler bei T ∓ 0,5 K. Sie
    melden sich nicht, weil es nichts zu tun gibt; die Rast danach meldet sich wie bisher.
  - **Ein Schritt mit Freigabe setzt nichts** (Zubrühen, Eis, weitere Schüttung): Der Regler hält die
    Temperatur davor, bis „Weiter“ gedrückt ist. Der Schritt danach bringt den neuen Sollwert, höher wie
    tiefer. Bei Eis heißt das: zügig zugeben oder vorher „Weiter“ drücken.
  - **Aufheizzeit zählt zur Rast** (Rezept, Stand 3e): Für eine solche Rast gibt es keinen Schritt
    „Aufheizen/Abkühlen auf T“. „Rast T · n min“ setzt den Sollwert und läuft die ganze Dauer ab ihrem
    Beginn, ohne auf den Fühler zu warten. Im Rasten-Timer von Hand meldet sich die Rast beim Beginn, damit
    der Brauer heizt. Dasselbe gilt für die Rasten der Teilmaische. Ein Schritt ohne Dauer (Abmaischen ohne
    Rast) behält sein „Aufheizen auf T“.
- **Fühler:** Die Schritte enden am Fühler der Messung „Maischetemperatur“ (Hauptguss:
  „Hauptgusstemperatur“). Ist keiner verknüpft oder fehlt er in der Registry, am Fühler, auf den der Regler
  regelt (`params.sensor`, bei mehreren Kanälen der erste). Weichen beide ab, sagt das ein Hinweis; ohne
  jeden Fühler wartet der Schritt auf „Weiter“. Erreicht die Maische die Temperatur nicht (HERMS mit Regler
  am HLT), hilft „Weiter“; ein Sollwert-Aufschlag ist offen (PLAN.md).
- **Hauptguss:** im Programm, wenn seine Heizquelle am Regler der Maische hängt (Ein-Topf, HERMS-HLT). Der
  Schritt setzt die Hauptguss-Temperatur, endet am Fühler und **wartet dann auf „Weiter“**, der Regler hält
  so lange. „Einmaischen“ setzt danach die Einmaischtemperatur. Hängt der Hauptguss an einer anderen
  Heizquelle, bleibt er ein Handgriff wie im Rasten-Timer, und der Regler geht erst mit dem Schritt nach dem
  „Weiter“ des Einmaischens an (kein Heizen in den leeren Behälter).
- **Rückfrage vor dem Start** (nicht verlangt, vom Nutzer im Plan bestätigt): Heizt das Programm sofort,
  fragt „Maischen starten“ nach („Der Regler … geht sofort an und heizt auf 67,0 °C. Ist der Hauptguss
  eingefüllt?“).
- **Dekoktion:** „Dekoktion: X l in ‹Kessel› ziehen“ (Freigabe, der Regler hält die Rast), dann der Ablauf
  im Dekoktionskessel: je Rast der Teilmaische „Teilmaische auf T heizen“ und „Teilmaische Rast T · n min“,
  „Teilmaische – Weiter bei Kochbeginn“, „Teilmaische kochen · n min“, „Teilmaische zurückgeben“ (Freigabe).
  - **Restmaische:** Der erste Schritt nach dem Ziehen schaltet den Regler der Maische aus, so wie der Plan
    rechnet (Stand 3d). Der Schritt nach dem Zurückgeben schaltet ihn mit der neuen Temperatur wieder ein.
    Mit „Restmaische halten“ im Rezept (Stand 3e) bleibt der Regler an und hält die alte Rast.
  - **Zweiter Kessel:** Hat die Heizquelle des Dekoktionsbehälters einen eigenen Regler, bekommt er die
    Sollwerte (Rasten, dann den Siedepunkt nach Höhe) und geht nach dem Zurückgeben aus. Ohne Regler dort
    sind dieselben Schritte Freigaben.
  - **Kochbeginn** meldet der Brauer wie beim Kochtimer: Ein Fühler kurz unter dem Siedepunkt ist kein
    sicheres Ende.
  - Der Rasten-Timer von Hand behält seinen einen Schritt „Dekoktion: … ziehen, kochen, zurück auf T“.
- **Ende:** „Maischen beendet – Weiter: Regler aus“ hält den letzten Sollwert und wartet auf Freigabe (bei
  HERMS kühlt der HLT so nicht aus, bevor jemand am Kessel steht). Danach schaltet „Regler aus“ alle Regler
  des Programms aus, und die Firmware meldet „Programm fertig“.
- **Stop (Firmware, für alle Programme):** „Stop“ schaltet jeden Regler und Aktor aus, den das Programm in
  irgendeinem Schritt anspricht, erst die Regler. Vorher blieb alles stehen, auch im Dashboard. „Fertig“ und
  „Pause“ lassen weiter alles, wie es ist.
  - „Timer abbrechen“, „Abschließen“ und „Löschen“ des Suds stoppen ein noch laufendes Programm und löschen
    es dann (`dropProgram`); der Abbrechen-Dialog sagt das. Ein beendetes Programm wird nur gelöscht.
- **Eingemaischt:** Steht ein Maischprogramm im Schritt nach dem ersten „Einmaischen“ und der Sud hat noch
  keine Zeit, trägt der Tab den Beginn dieses Schritts ein (`mashedInAt`, Zeit vom Gerät) und merkt sich das
  Log wie der Knopf. Gilt auch für den Rasten-Timer von Hand. Je Programm einmal: Eine Zeit, die der Brauer
  wieder leert, bleibt leer. Ist der Tab in diesem Schritt nicht offen, bleibt der Knopf.
- **Im Mock geprüft:** Start mit Rückfrage, Lauf bis „Regler aus“, Abbrechen (Stop, dann Löschen, Regler
  aus), die drei Hinweise, Dekoktion mit Regler am zweiten Kessel. **Am Gerät noch nicht** (PLAN.md).

**Stand 5c-2 (2026-10-14, `web/src/occupancy.ts`, `pages/CellarPlan.tsx`, `pages/brew/FermentTab.tsx`,
`brewDay.ts`, `fermentation.ts`; nur Web):** Belegungsplan, Gärplatz-Wahl nach dem Start, Anstellen.
- **Belegungsplan** oben auf der Sude-Liste, nur aus `GET /api/brews`:
  - Acht Wochen ab dem Montag der Vorwoche, Blättern um je eine Woche, Kopf mit Kalenderwoche (ISO 8601).
    Die Namensspalte bleibt beim Scrollen stehen, das Raster scrollt nur in der Karte.
  - Eine Zeile je Gärplatz, frei bleibt leer. „Ohne Gärplatz“ erscheint nur mit Suden; dort stehen auch Sude,
    deren Gärplatz gelöscht ist (Annahme).
  - Läuft = voller Balken, geplant = schraffiert, abgeschlossen = grau. Eine Überschneidung färbt beide Balken
    rot und steht als Satz unter dem Plan; gesperrt wird nichts. Überlappende Balken eines Gärplatzes liegen in
    Unterzeilen übereinander.
  - Ein laufender Sud mit `occupiedUntil` vor heute reicht bis heute („überfällig“) und zählt so auch bei der
    Überschneidung mit dem nächsten.
- **Gärplatz** (Tab Gärung): Bis zum Start wählt ihn der Kopf, danach der Tab. Die Wahl erneuert
  `fermenterId` und `frozen.fermenter` (mit dem Gärplatz von heute) und übernimmt beides in den Entwurf des
  Kopfs, sodass „Speichern“ nichts zurückschreibt. Die Optionen nennen Volumen und die Sude, die den Gärplatz
  im Zeitraum dieses Suds belegen.
  - **Hinweise** (`fermenterHints`, sperren nichts): Anstellwürze größer als das Volumen; Druck verlangt über
    dem, was der Gärplatz aushält; eine Phase liegt mehr als 2 K unter (über) der Umgebungstemperatur und der
    Gärplatz kann nicht kühlen (heizen). Ohne Umgebungstemperatur entfällt der letzte.
  - **Sperre** bei laufendem Gärprogramm kommt mit 5c-3 (Entscheidung 2026-10-14), weil es das Programm erst
    dann gibt.
  - Der **Trubverlust des Gärplatzes** ersetzt im Sud die Annahme des Rezepts (`brewInputs` trägt den
    Gärplatz). Er wirkt auf die Speise.
- **Anstellen:**
  - Messwerte: Anstellwürze (`batchVolume`, Soll `pitchL`, mit einem Verschnitt im Gärbehälter), Stammwürze
    (`pitchGravity`, neu, Soll = Stammwürze nach dem Verschnitt) und Anstelltemperatur (`pitchTemp`, Soll =
    erste Phase). Die Anstellwürze und -temperatur lassen sich wie bisher im Sudhaus mit einem Fühler
    verknüpfen.
  - **Gesamteffizienz** als Ist (`measuredFermenterPct`): Extrakt der Anstellwürze plus Extrakt der Speise
    (Ist, sonst Soll, bei der Stammwürze nach dem Kochen), weniger der Anteil von Zucker und Extrakt, der in
    den Gärbehälter kam, über dem Potenzial des Korns. Die Speise zählt mit, wie beim Soll (5c-1). Ein
    Verschnitt im Gärbehälter mischt im Rezept nach Masse, die Messung zählt nach Volumen: Bei 2 l Verschnitt
    liegt das Ist etwa 0,003 Punkte neben dem Soll.
  - Gaben „Anstellen“ (Zeitpunkt `pitch`) und „Dip Hopping“ mit Haken und Ist-Menge. Die Dip-Gaben stehen
    auch im Tab Würzekochen, mit demselben Zustand (Entscheidung 2026-10-14). Die Zeile einer Gabe ist dafür
    ein eigenes Bauteil (`AdditionRow`).
  - **„Angestellt“** (`pitchBrew`) setzt `phaseStartedAt.fermentation` und belegt den Gärplatz ab diesem Tag
    für dieselbe Spanne wie vorher. Die Zeit lässt sich korrigieren wie „Eingemaischt um“, das verschiebt die
    Belegung wieder. Geleert bleibt die Belegung, wie sie ist.
- **Index-Zeile:** Soll und Ist der Stammwürze bleiben ein Paar. Ist `pitchGravity` gemessen, gelten die
  Stammwürze der Anstellwürze (`ogPlato`) und die Messung (`ogActual`), sonst wie bisher die Werte nach dem
  Kochen. Abweichend vom Plan, der nur `ogActual` umstellte: Sonst stünden bei einem Verschnitt Soll vor und
  Ist nach dem Verschnitt nebeneinander.
- **Würze abzweigen:** Die Speise hat ihren Soll (`speiseVolume` aus `dilution.speiseL`); Dip bleibt ohne.
- **Gärführung:** Die Phasen des Rezepts nacheinander ab der Anstellzeit (`fermentationSchedule`), die
  aktuelle hervorgehoben. Vor dem Anstellen stehen Tage statt Daten.
- **Im Mock geprüft** (390 px, kein Querscrollen): Plan mit Überschneidung, überfällig, Blättern, „ohne
  Gärplatz“; Brautag starten, Gärplatz wechseln (Kopf ohne ungespeicherten Stand, Hinweise),
  „Angestellt“ und Korrektur der Zeit (Belegung wandert), Messwerte mit Gesamteffizienz und Index-Zeile,
  Speise-Soll im Würzekochen. Kein Gerät nötig, nur Web.

**Stand 5c-3 (2026-10-15, Firmware `ProgramRamp.h`, `ProgramRunner.cpp`; Web `brewPrograms.ts`,
`pages/brew/FermentTab.tsx`, `MaturationTab.tsx`, `DryHopList.tsx`):** Gärführung als Programm, Rampe, Stopfgaben.
- **Firmware: Schrittfeld `rampSec`.** Ein Regler-Sollwert läuft darüber linear vom Wert, den das Programm dem
  Regler in einem früheren Schritt gesetzt hat; ohne früheren Wert springt er. Aktorwerte rampen nicht.
  - Die Rampe hängt nur an den Schritten und der vergangenen Zeit des Schritts: Neustart und Aufwachen aus dem
    Deep Sleep setzen beim Wert zur Uhrzeit fort, eine Pause friert sie ein, „Fortsetzen“ läuft ohne Sprung
    weiter. Geschrieben wird höchstens einmal je Sekunde und erst ab 0,05 K Änderung, am Ende genau das Ziel.
  - Endet ein Schritt früher („Weiter“) oder wartet er auf Freigabe, steht der Sollwert auf dem Ziel, wie ihn
    auch ein Neustart herstellen würde. Eine Rampe weckt nicht eigens aus dem Deep Sleep.
  - Programm-Editor: Feld „Rampe“ (min/h/d) je Schritt, die Programmkarte zeigt sie mit ↗.
- **Generator** `fermentationProgram` mit `fermentControlOf` (Regler des Gärplatzes, wenn er temperiert, nicht
  von Hand und in der Registry ist) und `dryHops`:
  - **Der erste Schritt ist das Anstellen** (Entscheidung 2026-10-14): „Anstellen bei 12 °C – Weiter, wenn die
    Hefe drin ist“ wartet auf Freigabe; mit Regler kühlt er schon auf die erste Phase. Ab „Weiter“ laufen die
    Phasen, Tag d des Rezepts = d × 24 h danach. So entfällt jedes Aufholen auf eine ältere Anstellzeit.
  - Je Phase ein Schritt mit Sollwert, `enabled: true` und `rampSec` aus `rampDays`. Eine Rampe der ersten Phase
    entfällt (sie beginnt bei ihrer eigenen Temperatur). Phasen ohne Dauer fehlen.
  - Stopf-Zugabe (`dryHopDay`) und Entnahme (`dryHopDay + dryHopDays`) teilen die Phase; der Schritt meldet sich
    („Stopfen: 50 g Citra“, „Hopfen entnehmen: Citra“), was zugleich fällig ist, steht in einem Schritt, auch mit
    dem Phasenbeginn. Fällt die Teilung in eine Rampe, bekommt der Teil davor den Zwischenwert. Gaben ohne Tag
    sind nicht im Programm; eine Entnahme nach dem Ende kommt als letzter Schritt.
  - Druck nur mit „Unter Druck vergären“: Der Phasenbeginn meldet „Spundapparat auf 1,0 bar“.
  - Ende mit Regler: „Gärführung beendet – Weiter: Regler aus“, dann „Regler aus“. Ohne Regler meldet jeder
    Phasenbeginn ab der zweiten „Reifung: auf 2 °C stellen“ bzw. „in 2 Tagen auf 18 °C“, ohne Endschritt.
- **Tab Gärung:** Karte „Gärprogramm“ (`fermentProgramId`), mit Rückfrage, weil der Regler sofort angeht.
  - „Angestellt“ ist, solange das Programm im ersten Schritt wartet, dessen „Weiter“. Die Anstellzeit kommt dann
    vom Programm (`pitchedAtOf`: Programmuhr, Pausen eingerechnet), einmal je Programm wie „Eingemaischt“; eine
    geleerte Zeit bleibt leer. Die Belegung wandert wie bei „Angestellt“.
  - Die aktuelle Phase kommt vom laufenden Programm (`phaseOf`), sonst aus der Anstellzeit.
  - Die Gärplatz-Wahl ist gesperrt, solange das Programm läuft (aktiv, wartend, pausiert).
  - „Timer abbrechen“, „Abschließen“ und „Löschen“ nehmen das Programm mit (`dropProgram`).
- **Stopfgaben** (Entscheidung 2026-10-14: nach Zeitpunkt): „Hauptgärung“ im Tab Gärung, „Reifung“ im neuen Tab
  Reifung. Je Gabe Haken mit Zeit (`addedAt`, mit Datum, wenn nicht von heute), Ist-Menge mit Nachbuchen, geplanter
  Tag mit Datum ab Anstellen und Haken „entnommen“ (`checked`: `removed:<row id>`, kein neues Feld).
- **Im Mock geprüft** (390 px, kein Querscrollen): Start mit Rückfrage, Schritte und Rampen wie erwartet,
  „Angestellt“ schaltet das Programm weiter und übernimmt dessen Zeit, Gärplatz gesperrt, aktuelle Phase vom
  Programm, Stopfgaben in beiden Tabs, Feld „Rampe“ im Editor.
- **Am LilyGo geprüft** (2026-10-15): Rampe mit Neustart, Pause und „Weiter“ mitten darin; das echte Gärprogramm
  mit kurzen Phasen von „Angestellt“ bis „Regler aus“, alle Pushes angekommen (SESSION.md).

**Stand 5c-4 (2026-10-15, Firmware `WebUI.cpp`, `RecipeFiles.h`; Web `brewReadings.ts`, `fermentCourse.ts`,
`fermentation.ts`, `pages/brew/Readings.tsx`, `FermentCourse.tsx`):** Messungen von Hand, Gärverlauf.
- **Route** `GET/PUT /api/brews/<id>/readings` → `/brewreadings/<id>.json` (nur SD-Boards). Der Körper ist
  `{ id, readings: [{ at, kind, v, note? }] }` (`kind`: `gravity` in °P, `brix` roh, `temp`, `ph`), geschrieben
  über `JsonDocDir::write` (Temp-Datei). Die Grenze ist der Body von 16 KB (etwa 300 Messungen); das Web prüft
  vorher (`fitsLimit`). Ohne Datei antwortet GET 404, das Web liest das als „keine Messung“.
  - Die Handler stehen vor denen von `/api/brews/<id>`, die die Id sonst als ungültig ablehnen (`GetPrefixHandler`
    und `PutJsonPrefixHandler` bekamen ein optionales Suffix; die Id kommt aus `brewReadingsId`, nativ getestet).
  - `DELETE /api/brews/<id>` löscht die Messungen mit, auch wenn der Sud selbst fehlte.
- **Sud-Sicherung** (`brewcontrol-brews`) trägt die Messungen unter `readings` mit (je Sud ein Dokument, nur wenn
  er welche hat); eine ältere Sicherung ohne den Schlüssel lässt sich einspielen.
- **Gärplatz:** `densitySensor` (Auswahl im Dialog nach dem Temperaturfühler, Hinweis bei fremder Einheit).
- **Karte „Messungen“** in Gärung und Reifung: Dichte (°P/SG/°Bx), Temperatur, pH mit Zeit und Notiz, sofort
  gespeichert. SG wird beim Eintragen zu °P, °Bx bleibt roh und wird mit der Stammwürze (`pitchGravity`, sonst
  Soll) über `apparentExtractFromRefractometer` zur Dichte; ohne Stammwürze bleibt der Punkt ungezeichnet. Das
  Eingabefeld ist ein eigenes Textfeld statt `GravityInput`, weil dieses bei jedem Tastendruck neu formatiert.
- **Gärverlauf** (Karte in Gärung, uPlot, x = Tage ab Anstellen, °C links, °P rechts): Soll aus Phasen und Rampen
  (`fermentSollCourse`, dieselbe Linie wie der Programm-Generator), Ist-Temperatur, Regler-Sollwert und Dichte aus
  dem Log, Handmessungen als Punkte. Das Log ist `fermentLogId`, sonst das erste, das den Fühler des Gärplatzes
  aufzeichnet. Fehlende Spalten im Log erklärt ein Hinweis; bei mehr als 20 000 Zeilen steht ein Hinweis zum
  Intervall, weil die ganze Session geladen wird. Bei mehreren Sessions zeigt der Verlauf nur die jüngste, die vor
  dem Planende begann.
- **Im Mock geprüft** (Wegwerf-Mock mit Log, Regler, Spindel): Verlauf mit zwei Skalen und Punkt, Eintragen und
  Löschen, Karte in der Reifung, 375 px ohne Querscrollen. Am Gerät nicht geprüft.

**Stand 5c-5 (2026-10-16, Web `bottlingDay.ts`, `brewDay.ts`, `pages/brew/BottlingTab.tsx`, `FinishRow.tsx`,
`MaturationTab.tsx`; Firmware `RecipeFiles.h`):** Reifung und Abfüllung, Bilanz, Index.
- **Messwerte** (`MeasureId`, im Sud gespeichert wie die übrigen):
  - `finalGravity` (Restextrakt, scheinbar): Soll = Stammwürze der Anstellwürze × (1 − Vergärungsgrad der Hefe), dasselbe wie
    `fgPlato` des Rezepts. Vorschlag mit „übernehmen“ ist die letzte Dichte-Messung von Hand (`lastGravity`; °Bx mit der
    Stammwürze umgerechnet).
  - `maxTempAfter`: Höchsttemperatur nach dem Gärende, Soll = höchste Phasentemperatur. Von Hand, ohne Vorschlag.
  - `bottledVolume`: Soll aus der Kette mit den Abfüllverlusten der Gebinde (`calcBottling`). Vorschlag ist die Summe der
    Gebinde-Zeilen.
  - Restextrakt und Höchsttemperatur stehen in der Reifung (Karte „Messwerte nach der Gärung“) **und** in der Abfüllung, mit
    demselben Zustand (`FinishRow`); die Abfüllmenge nur in der Abfüllung. `MeasureRow` bekam dafür `suggest`.
- **Karbonisierung** (Karte Rezept | Jetzt): neu gerechnet mit dem Bier, wie es gebraut wurde (`beerNow`: gemessene Anstellwürze,
  sonst Soll, ohne Trub und Stopfhopfen, plus die abgezweigte Speise), der gemessenen Höchsttemperatur (`calcCarbonation` bekam
  `tempC`) und dem gemessenen Restextrakt. Bei Speise steht darunter, ob die abgezweigte Menge reicht oder wie viel fehlt (0,05 l
  Spielraum); die nötige Menge rechnet `speiseVolumeL` mit der Ausschlag-Stammwürze (gemessen, sonst Soll) und dem Vergärungsgrad der
  Hefe, nicht dem gemessenen.
- **Gebinde und Abfüllen:**
  - Zeilen Gebinde × Anzahl, vorbelegt aus dem Rezept (Spalte „Rezept“). Die Anzahl je Gebinde steht im Sud als `containerCounts`
    (Id → Anzahl, feldweise gespeichert); fehlt das Feld, gilt der Plan. Gebinde lassen sich hinzufügen und entfernen.
  - **Gebinde sind nicht eingefroren:** Der Sud liest sie live aus `/api/containers` (`BrewInputs.containers`), die Abfüllverluste im Soll
    sind die von heute. Der Bestand (`Container.count`) wird nicht abgebucht (PLAN.md).
  - Rezeptzeilen mit Zeitpunkt „Abfüllung“ (Zucker, Abfüllhefe) als `AdditionRow` mit Haken und Ist-Menge (`rebook`).
  - **„Abgefüllt“** (`bottleBrew`) setzt `phaseStartedAt.bottling` und `occupiedUntil` auf den Tag; die Zeit lässt sich korrigieren wie
    „Angestellt um“, das verschiebt das Ende der Belegung. Eine geleerte Zeit lässt die Belegung, wie sie ist. Der Sud bleibt „Läuft“,
    bis er abgeschlossen wird.
- **Bilanz:** Volumen entlang der Kette (Ausschlag, Anstellwürze, Speise, Jungbier, Abgefüllt) und Effizienzen (Maische, Sudhausausbeute,
  Gesamt) als Soll | Ist | Abweichung; dazu Stammwürze, Restextrakt, Alkohol und Endvergärungsgrad. Das Jungbier hat nur mit gemessener
  Anstellwürze ein Ist.
- **Alkohol und Endvergärungsgrad** (`actualBeer`, nach Balling aus `ballingBeerAnalysis`): Die Stammwürze ist die der Anstellwürze
  (`pitchGravity`), ohne Verschnitt im Kessel auch die nach dem Kochen; bei einem Verschnitt im Kessel steht bis zur Messung der
  Anstellwürze die geplante (`estimated`, Hinweis in der Zeile). Mit Speise (Karbonisierung `speise`) ist der Alkohol der des
  fertigen Biers: der Anteil des Jungbiers, verdünnt um die Speise, plus der Alkohol aus ihrer Gärung (`speiseAlcoholPct`: das
  CO₂ aus Zielmenge minus Rest, je 44,01 g CO₂ kommen 46,07 g Ethanol, 0,789 g/ml). Das gilt für Soll und Ist; der Endvergärungsgrad
  bleibt der der Hauptgärung.
- **Index-Zeile:** `withResults` füllt `fgPlato`, `abvPct`, `attenuationPct` und `bottledL` (alles Ist) und entfernt sie, wenn die Messung
  fehlt. `brewSummaryLine` (Firmware) nimmt die drei neuen Felder auf, `openapi.yaml` (`BrewSummary`, `Brew.containerCounts`) ist
  nachgezogen. Der Rezept-Tab „Sude“ zeigt Alkohol, Endvergärung und Restextrakt; die Spaltenköpfe erscheinen erst ab 1280 px (davor
  steht der Name der Spalte im Wert), weil die Zeile mit neun Spalten schon bei 820 px umbrach.
- **Im Mock geprüft** (Wegwerf-Mock mit Sud, Rezept, Gebinden und Messungen): Vorschläge übernehmen, Höchsttemperatur ändert die
  Restkohlensäure und den Zucker, Gebinde ändern, „Abgefüllt“ setzt `occupiedUntil`, Speise-Urteil („es fehlen 0,2 l“), Bilanz,
  Spalten im Rezept-Tab; 375 px und 820 px ohne Querscrollen. **Am Gerät nicht geprüft** (PLAN.md).

- **Kopf:** Status, Rezeptversion, Brautag, Sudhaus und Gärplatz; die Phasen als nummerierte Tabs mit
  erledigt/aktuell.
- **Messwerte** stehen überall als Zeile Messwert | Soll laut Rezept | Ist | Abweichung. Die Abweichung ist
  als Abzeichen markiert, Daraus ergeben sich die Effizienzen: Maische, Sudhausausbeute, gesamt.
- **Vorbereitung:**
  - Wassermengen
  - Aufbereitung für Hauptguss und Nachguss (Maische-Säure steht im Tab Maischen)
  - pH von Haupt- und Nachguss
  - Einfache Zutatenliste nach Fermentierbarem, Hopfen und Hefe zum Abhaken. **Bewusst nicht** nach
    Prozessschritt.
- **Maischen:**
  - Verlauf Soll/Ist mit Heizleistung vom verknüpften Regler
  - Rasten Soll/Ist
  - **pH & Säure in drei Schritten:** pH nach dem Einmaischen messen → Säure (Rezeptmenge, Vorschlag aus
    der Messung, Ist) → pH danach
- **Würzekochen:**
  - Kochtimer mit nächster Gabe
  - Messwerte vor und nach dem Kochen
  - Hopfengaben zum Abhaken
  - Würze abzweigen für Speise und Dip Hopping
- **Gärung:**
  - Gärplatz mit Belegung wählen; reservierte oder belegte Plätze sind sichtbar
  - Anstellen
  - Gärführung mit aktueller Phase
  - Diagramm aus Gerätelog und manuellen Messungen
- **Reifung:** Messungen, Notizen, Stopfgaben.
- **Abfüllung:**
  - Karbonisierung, mit dem gemessenen Restextrakt neu berechnet
  - Stammwürze, Restextrakt und Volumen
  - Bilanz der Effizienzen und Volumen
- **Pumpen und Geräte in den Sud-Tabs:** Die Geräte des Sudhauses mit Aktor (Pumpen der Transfers und der
  Umwälzung, Rührwerk, Ventile, Kühler, Kondensator) erscheinen in ihrem Tab und lassen sich **schalten**,
  mit Live-Zustand. Die Besitzregeln wie in `web/src/ownership.ts` gelten: Ein Gerät, das gerade einem
  Regler oder Programm gehört, lässt sich nicht schalten. Laufzeit und Menge je Transfer, wie im Canvas
  gezeigt, gibt es nicht (Stand 5b-4).

### Plan 5b – Brautag (Vorbereitung, Maischen, Würzekochen)

> Erstellt 2026-10-12 in einer Planungssession, ins Repo übernommen mit 5b-1. Umgesetzt wird **jede
> Teil-Etappe in einer eigenen, neuen Session** mit einem eigenen PR. Jede Session startet im Planmodus mit:
> „Setze Sud 5b-n laut `rezept-sud-editor.md` › Plan 5b um“.

**Modell und Aufwand je Teil-Etappe.** „Umfang“ ist die Einschätzung nach dem Schema aus PLAN.md
(klein/mittel/groß); „Effort“ ist die Einstellung für die Session (`/model`, Effort-Regler).

| Etappe | Modell | Effort | Umfang | Planmodus | Grund |
|---|---|---|---|---|---|
| 5b-1 Messwerte, Vorbereitung | Opus | hoch | mittel | mit Plan | Neue Rechnungen (Vorkoch-Stammwürze, Effizienz rückwärts, Konversion nach Troester), Datenmodell der Messwerte und Speichern ohne gegenseitiges Überschreiben, Größenmessung. |
| 5b-2 Maischen | Opus | hoch | mittel | mit Plan | Säurevorschlag aus gemessenem pH (pH-Modell); führt das Firmware-Flag `notify` ein, weil der Rasten-Timer der erste Nutzer ist. |
| 5b-3 Würzekochen | Sonnet | mittel | mittel | mit Plan | Gaben-Programm auf dem Muster aus 5b-2, Index-Felder, Spalten und Diagramm im Tab „Sude“. |
| 5b-4 Maischverlauf, Pumpen | Sonnet | mittel | mittel | mit Plan | Log-Diagramm und Pumpen nach vorhandenen Mustern (`MashCurve`, `ownership.ts`). |

#### Kontext
Das Sud-Gerüst ist gemergt (5a, PR #94): Ablage `/api/brews` mit Index, Start mit eingefrorenen Kopien
(`brew.frozen`: Sudhaus, Brauerei, Gärplatz, Zutatenwerte), Abbuchen und Versionsregel.

5b füllt die drei Brautag-Tabs mit **Soll/Ist-Messwerten** (Zeile Messwert | Soll | Ist | Abweichung). Die
Sollwerte kommen aus den vorhandenen Rechnungen auf den Kopien des Suds.

**Entscheidungen des Nutzers**
- **Umfang**
  - Maische-Säure in drei Schritten.
  - Rasten Soll/Ist mit Timer, aber **nur ohne Regelung** (Maischheizung „von Hand“).
  - Würze abzweigen (Speise, Dip Hopping).
  - Maischverlauf aus dem Gerätelog mit Heizleistung.
  - Pumpen/Transfers mit Start/Stopp.
- **Effizienz-Spalten** im Rezept-Tab „Sude“ kommen aus der **Index-Zeile**. Dafür braucht
  `brewSummaryLine` neue Felder, also eine kleine Firmware-Änderung.
- **Lager:** Die Ist-Menge je Zutat lässt sich ändern. Die Differenz zur Abbuchung beim Start wird am
  Lagerposten nach- bzw. zurückgebucht und in `booked` vermerkt.
- **Kochtimer als Programm** (Vorschlag des Nutzers, Einschätzung unten): Der Sud legt ein
  Firmware-Programm an. Seine Schritte schalten nichts, sondern melden „30 g Hallertau Mittelfrüh zugeben“.

#### Einschätzung: Gaben als Programm statt Browser-Timer
**Dafür spricht, dass fast alles schon da ist:**
- Ein Schritt darf ohne Ziele sein (`ProgramStep.targets = {}`).
- `confirm: true` hält an und löst über `AlarmStore::onProgramStatus` eine `awaiting`-Meldung mit Push aus.
  „Weiter“ (`POST /api/programs/{id}/control`, `next`) ist das Quittieren der Gabe.
- Das Programm läuft auf dem Gerät weiter, auch bei geschlossener Seite und nach einem Neustart
  (Resume-Pfad).

**Lücken:**
1. **Die Meldung nennt nur den Programmnamen**, nicht den Schritt. Ändern: Bei `awaiting` den Namen des
   aktuellen Schritts als Text der Meldung mitgeben. Das betrifft `ProgramRunner.cpp`,
   `AlarmStore::onProgramStatus` und die Alert-Darstellung in der UI.
2. **Drift:** `confirm` hält die Uhr an, bis quittiert wird. Bei Verspätung rutschen die folgenden Gaben
   nach hinten. Abhilfe: Die Schritte enden zeitgesteuert ohne `confirm`, und nur der Schritt *vor* einer
   Gabe hat `confirm`.
   - Besser ist ein eigenes Flag „melden ohne anzuhalten“ (`notify: true`). Es löst die Meldung beim
     Schrittwechsel aus, und die Uhr läuft weiter.
   - Das ist eine kleine, saubere Firmware-Erweiterung; empfohlen.
3. **Aufräumen:** Das Programm gehört dem Sud (`brew.boilProgramId`). Beim Abschluss der Phase oder beim
   Löschen des Suds wird es gelöscht.

**Dasselbe Muster passt auf die Rasten ohne Regelung:** ein Programm mit einem Schritt je Rast, Haltezeit
wie im Maischeplan und Meldung „Rast 63 °C beendet“. Das ist der gewünschte Timer.

Mit Regelung ließe sich daraus später ein Maischprogramm mit Sollwerten erzeugen (je Rast „aufheizen bis
Fühler ≥ T“, dann „halten“). Das war nicht Teil von 5b-1 bis 5b-4 und ist mit Stand 5b-5 umgesetzt: Die
Programm-Karte steht im Tab Maischen auch bei Regelung.

#### Teil-Etappen (je ein PR)

##### 5b-1 Messwerte und Vorbereitung
- **`web/src/brewDay.ts`** (rein, getestet): Es gibt drei Funktionen.
  - **`brewTargets(brew, recipe)`** rechnet mit der Kette aus `pages/recipe/tabs.tsx` auf `frozen`:
    `calcStats`, `wortExtract`, `calcWater`, `calcMash`, `calcTreatment`. Vor dem Start nimmt sie die
    Live-Daten wie bisher.
    - Liefert die Sollwerte je `MeasureKey`: Hauptguss/Nachguss (l, °C), pH Hauptguss/Nachguss
      (`col.after.ph`), Maische-pH (Mash-Spalte `ph.after`), Pfannevoll (`preBoilL`) und Stammwürze vor
      dem Kochen.
    - **Die Vorkoch-Stammwürze ist neu:** `platoFromExtract(extractKg ohne Kochzucker,
      preBoilL·(1−shrink))`, analog `platoHot` in `recipeWater.ts`. `wortExtract` muss dafür die
      Gabe-Zeitpunkte bzw. den Grist zurückgeben.
    - Weitere Sollwerte: Ausschlag (`knockOutL`, `kettlePlato`) und Siedepunkt.
  - **`measuredEfficiency(brew, …)`** rechnet rückwärts, konsistent zur Vorwärtskette:
    - Extrakt = V_heiß·(1−shrink)·SG·°P/100
    - Maischeeffizienz = (Extrakt − Fremdextrakt) / Potenzial
    - Sudhausausbeute = Maischeeffizienz × Potenzial/kg
    - Konversion aus der Vorderwürze (Troesters Mash Gravity Test, Formel mit `TODO(verify)`)
    - Läutereffizienz = Maischeeffizienz / Konversion
  - **`deviation(key, soll, ist)`** liefert Text und Stufe ok/warn. Die Toleranzen sind Annahmen und
    stehen an einer Stelle: °P ±0,2, Volumen ±2,5 %, pH ±0,1, °C ±1 K, Effizienz ±2 Punkte.
- **Modell** (`brews.ts`, rückwärtskompatibel, keine Migration):
  - `measurements?: Partial<Record<MeasureKey | 'mashPhAcid', { v: number; at: number; src?: string }>>`
  - `checked?: string[]`
  - `rowAmounts?: Record<rowId, number>`
  - `notes` je Phase optional.
- **Speichern:**
  - Messwerte und Haken werden **sofort beim Bestätigen** gespeichert (Enter/Blur). Dabei wird der Sud
    frisch geladen, das eine Feld gesetzt und per `PUT` geschrieben, damit sich Handy und Laptop am
    Brautag nicht gegenseitig überschreiben.
  - Kopf und Notizen behalten den Speichern-Knopf.
- **Sensor oder Hand:**
  - Ist die Messung im Sudhaus mit einem Sensor verknüpft (`frozen.brewhouse.measurements[key]`), zeigt
    die Zeile den Live-Wert aus dem Snapshot und einen Knopf „übernehmen“. Gespeichert wird mit
    Zeitstempel und `src`.
  - Sonst gibt es ein Eingabefeld; Stammwürze über `GravityInput` (°P/SG/°Bx).
- **UI:**
  - **`pages/brew/MeasureRow.tsx`:** die Zeile Messwert | Soll | Ist | Abweichungs-Abzeichen.
  - **Tab Vorbereitung:**
    - Wassermengen mit Aufbereitung je Hauptguss/Nachguss (Dosen aus `calcTreatment`, abhakbar).
    - pH Haupt- und Nachguss.
    - Die Zutatenliste nach Vergärbarem, Hopfen und Hefe, zusammengefasst je Zutat und Lagerposten, mit
      Ist-Menge und Haken. Eine Warnung erscheint, wenn der Bestand oder die Abbuchung nicht reicht.
- **Lager:** `rebook(brew, rowId, newAmount)` bucht die Differenz am Posten. Das Prinzip ist dasselbe wie
  bei `bookStock`: höchstens bis 0, und `booked` wird nachgeführt.
- **Entscheidungen der Umsetzungssession (2026-10-12):**
  - Neuer Messwert **`strikeTemp`** (Hauptgusstemperatur) im Sudhaus, mit einem Fühler verknüpfbar wie
    die anderen.
  - Die **Ist-Menge** steht **je Gabe** (Rezeptzeile, `rowAmounts`); die Gruppe je Zutat und Posten zeigt
    Summe, Bestand und Haken, mehrere Gaben stehen eingerückt darunter.
  - Soll von Haupt- und Nachgussmenge ist die **Einfüllmenge** (`strikeFillL`/`spargeFillL`, mit Totraum
    und Leitung), darunter die Menge in die Maische.
- **Verifikation:**
  - Tests für `brewTargets` mit Vorlage `herms3` und einem Testrezept (Werte gegen die Rezept-Übersicht).
  - Tests für `measuredEfficiency`: Ein Sud mit Ist = Soll ergibt genau die Rezept-Effizienzen.
  - Tests für `deviation` und für `rebook` (nach- und zurückbuchen).
  - Im Mock: Messwert eintragen, neu laden, der Wert ist da; zwei Tabs speichern verschiedene Felder,
    beide bleiben erhalten.
  - **Größe messen:** Der Sud muss mit einem großen Rezept nach dem Start inklusive Messwerten deutlich
    unter 16 KB bleiben. Die gemessene Zahl kommt in SESSION.md.

##### 5b-2 Maischen
- **Maische-Säure in drei Schritten:**
  1. pH nach Einmaischen messen.
  2. Säure: Rezeptmenge, Vorschlag und Ist-Menge. Der Vorschlag kommt aus `suggestAgent(col, targetPh, …)`;
     die Mash-Spalte bekommt dafür den **gemessenen** pH als Ausgangswert statt des Modell-pH. Die
     Ist-Menge zählt wie eine Zutat und wird über `rebook` gebucht.
  3. pH danach (`mashPhAcid`).
- **Vorderwürze** (`firstWortGravity`) ergibt die Konversion als Ist.
- **Rasten ohne Regelung** (Maischheizung „von Hand“ laut `heatingOf(frozen.brewhouse,'mash')`):
  - Tabelle aus `calcMash().rows` mit Soll-Temperatur und -Dauer und Ist-Temperatur von Hand.
  - Dazu der Rasten-Timer als Programm (siehe Einschätzung): „Maischen starten“ legt es an und startet es.
- **Mit Regelung** entfällt die Rasten-Tabelle; stattdessen kommt der Verlauf aus 5b-4.
- **Firmware (hierher gezogen, erster Nutzer):**
  - Programm-Schritt `notify`: meldet beim Schrittwechsel, ohne anzuhalten, und die Meldung trägt den
    Schrittnamen.
  - Betroffen sind `ProgramSteps.cpp/.h`, `ProgramRunner.cpp` und `AlarmStore`. Native Tests kommen dazu.
  - Im selben Commit: `openapi.yaml` und `web/src/types.ts`.
  - **Flash:** betrifft alle Boards, also esp32dev messen (zuletzt 98,0 %, 37 739 Byte frei); Erwartung
    unter 1 KB.
- **Verifikation:**
  - Ein Test für den Vorschlag mit gemessenem pH.
  - Tests für den Programm-Generator der Rasten (Schritte, Haltezeiten, Meldetexte).
  - Im Mock: Programm wird angelegt; nach Abschluss oder Löschen ist es weg.

##### 5b-3 Würzekochen
- **Kochen starten:**
  - Legt das Gaben-Programm an. Die Schritte sind die Zeitabstände zwischen den Gaben aus `boil` und den
    Hopfen-Zeilen (`timeMin`, Vorderwürze, Whirlpool); die Meldung lautet „{Menge} {Name} zugeben“.
    Danach wird es gestartet.
  - Der Kopf zeigt Restzeit und nächste Gabe aus `GET /api/programs` (Polling wie im Dashboard).
- **Hopfengaben** sind abhakbar mit Zeitstempel; die Ist-Menge wird über `rebook` gebucht.
- **Messwerte vor und nach dem Kochen:** Pfannevoll, Stammwürze, pH, Ausschlag, Luftdruck. Der Luftdruck
  ergibt den Siedepunkt (`boilingPointC`) und wird als Wert angezeigt. Dazu zeigt die Zeile die
  Effizienzen Maischeeffizienz und Sudhausausbeute (Ist).
- **Würze abzweigen** (Speise, Dip Hopping) mit Ist-Litern.
  - Den Soll für Dip Hopping liefert das Rezept nicht mehr („Würzemenge entfällt“). Die Speise braucht die
    Karbonisierungsrechnung, die erst mit dem Gärung-Tab kommt.
  - **5b zeigt deshalb nur Ist-Felder ohne Soll;** der Soll kommt mit 5c.
- **Index:**
  - `brewSummaryLine` bekommt `ogPlato`, `ogActual`, `mashEffPct`, `yieldPct` und `bottledL` (für 5c, leer
    bis dahin). Der Sud schreibt die Ist-Ergebnisse beim Speichern in diese Felder.
  - Im Rezept-Tab „Sude“ kommen die Spalten Stammwürze Soll/Ist, Maischeeffizienz, Sudhausausbeute und ein
    kleines Effizienz-Diagramm über die Sude dazu (uPlot wie `MashCurve`).
- **Verifikation:**
  - Test des Gaben-Generators (60/10/0 min, Vorderwürze, Whirlpool, mehrere Gaben im selben Zeitpunkt in
    einem Schritt).
  - Im Mock: Gaben-Liste, Restzeit, Haken.
  - **Nicht in der Cloud prüfbar:** Push am Gerät und das Programm über einen Neustart.

##### 5b-4 Maischverlauf und Pumpen
- **Verlauf:**
  - Der Sud merkt sich `logId` (Auswahl aus `GET /api/logs`, vorgeschlagen ist das Log, das den
    Maischfühler enthält).
  - Das Diagramm zeigt Soll und Ist: Die Soll-Kurve kommt aus `calcMash().rows`, verankert an
    `phaseStartedAt.mash`; Ist ist die Temperatur aus `getLogData(logId)` im Zeitfenster.
  - Die Heizleistung ist der Aktor des Reglers (`heatingOf(...).heater.controller` → `params.actuator`,
    Prozent wie `outputPct` in `ControllerCard.tsx`, das dafür exportiert wird).
  - Live-Punkte kommen per SSE dazu.
- **Pumpen:**
  - Die Transfers aus `frozen.brewhouse.transfers` mit `drive: 'pump'` erscheinen in ihrem Tab. Start/Stopp
    über `writeActuator` auf den Aktor des Pumpen-Geräts.
  - Gesperrt, wenn `controllerOwnerOf`/`programOwnerOf` eine Pumpe gerade einem Regler oder Programm
    zuordnet; der Grund steht am Knopf.
  - Laufzeit und Menge (`flowLPerMin` × Laufzeit) werden als `transfers[id] = {startedAt, stoppedAt}` im
    Sud gespeichert.
- **Entscheidungen der Umsetzungssession (2026-10-13), Einzelheiten unter „Stand 5b-4“:**
  - Der Zeitanker `phaseStartedAt.mash` ist das **Einmaischen**, gesetzt per Knopf.
  - Das Diagramm steht in **jedem** Maischen-Tab, nicht nur bei Regelung.
  - Die Liste zeigt **Geräte statt Transfers** (`DeviceList.tsx` statt `TransferList.tsx`), auch Rührwerk,
    Ventile, Kühler und Kondensator; Läutern und Nachguss in beiden Tabs.
  - **Keine** gespeicherte Laufzeit und Menge, also kein `transfers`.
  - Geschaltet wird mit `enableActuator` statt `writeActuator`.
- **Verifikation:**
  - Test der Soll-Kurve mit Zeitanker.
  - Im Mock mit Snapshot-Stub: Pumpe schalten, Sperre bei Regler-Besitz, Laufzeit.
  - **Nicht in der Cloud prüfbar:** Diagramm mit echtem Log am Gerät.

#### Anknüpfung für 5c (Gärung, Reifung, Abfüllung, Belegungsplan)
Diese Teile aus 5b nutzt 5c, ohne dass gespeicherte Sude umgebaut werden müssen:
- **Belegung:** `fermenterId`, `occupiedFrom` und `occupiedUntil` stehen seit 5a im Sud und in der
  Index-Zeile.
  - Der Belegungsplan liest nur `GET /api/brews`.
  - Beim Anstellen setzt 5c `occupiedFrom` auf den tatsächlichen Tag; beim Abfüllen setzt es
    `occupiedUntil` auf den Tag, an dem der Gärplatz frei wird.
  - Den Gärplatz wählt der Sud in 5c, sobald er am Ausschlagen ankommt. Die Kopie in `frozen.fermenter`
    wird dann erneuert.
- **Messwerte:** Das Muster aus 5b-1 (`measurements`, `MeasureRow`, `deviation`) trägt auch Anstellwürze
  (`batchVolume`, `pitchTemp`), Restextrakt und Abfüllmenge.
  - **Messreihen der Gärung** (Spindel und Temperatur über Wochen) gehören **nicht** ins Sud-Dokument,
    wegen der 16-KB-Grenze. Sie kommen aus dem Gerätelog, gewählt wie in 5b-4 über `logId`.
  - Von Hand eingetragene Messreihen kommen in eine eigene Datei je Sud (seit 5c-4, siehe „Stand 5c-4“).
- **Gärführung als Programm:** Der Generator aus 5b-2/5b-3 (`brewPrograms.ts`) bekommt eine Variante für
  die Gärphasen des Rezepts (`recipe.fermentation`). Sie setzt Sollwerte auf den Regler des Gärplatzes
  (`frozen.fermenter.controller`), meldet Stopfgaben mit `notify` und gehört wie die anderen Programme dem
  Sud.
  - Das ist der offene Punkt „Gärführung als Programm“ unter Offen / später.
- **Würze abzweigen:** Die Ist-Liter der Speise aus 5b-3 bekommen in 5c ihren Soll.
  - Der Soll kommt aus der Karbonisierungsrechnung und der Abfüllmenge im Gärung-Tab des Rezepts (PLAN.md
    › Hopfenform und Abfüllmenge).
  - Dip Hopping bleibt ohne Soll (Entscheidung 2026-10-14): Das Rezept gibt keine Würzemenge vor, und für
    die Abfüllmenge zählt nur die Hopfenaufnahme.
- **Index-Felder:** `bottledL` ist in 5b-3 schon angelegt; 5c füllt es.
  - Weitere Felder für die Liste (z. B. Alkohol, Endvergärung) brauchen dann wieder eine kleine Änderung an
    `brewSummaryLine`.
- **Lager:** `rebook` aus 5b-1 bucht auch Hefe, Stopfhopfen und Speisezucker der Gärphasen.
- **Modell für 5c:** je Teil-Etappe, siehe Plan 5c (Schnitt in sechs PRs, Entscheidungen 2026-10-14).

#### Dateien (Überblick)
- **Neu:** `web/src/brewDay.ts`, `brewDay.test.ts`, `web/src/brewPrograms.ts` (+ Test),
  `pages/brew/PrepTab.tsx`, `MashTab.tsx`, `BoilTab.tsx`, `MeasureRow.tsx`, `TransferList.tsx`.
- **Geändert:**
  - Web: `brews.ts` (Felder, `rebook`), `pages/BrewPage.tsx` (Tabs füllen), `pages/recipe/BrewsTab.tsx`
    (Spalten), `recipeStats.ts` (Grist und Zeitpunkte zurückgeben), `components/ControllerCard.tsx`
    (`outputPct` exportieren).
  - Firmware: `RecipeFiles.h` (Index-Felder), `ProgramSteps.*`, `ProgramRunner.cpp`, `AlarmStore.cpp`,
    Tests.
  - Doku: `openapi.yaml`, README.
- **Doku nach jeder Teil-Etappe:**
  - `rezept-sud-editor.md` (Stand 5b-n).
  - `PLAN.md`: Erledigtes raus. Neu rein: „Maischprogramm aus dem Plan für geregelte Maischen“ und „Soll für
    Speise/Dip Hopping“ bei 5c.
  - `SESSION.md`.
  - Alles am Gerät wird als „nicht geprüft“ geführt.

#### Verifikation gesamt
- `pnpm typecheck`, `pnpm test`, `pnpm build`; Hauptbundle vergleichen, denn die Brautag-Seiten liegen im
  Paket-Chunk.
- `npx @redocly/cli lint …`.
- Native Firmware-Tests mit g++/Unity außerhalb von PlatformIO, wie bei 5a. Compile, `pio test` und
  esp32dev-Flash prüft der Nutzer lokal.
- Browser gegen einen Wegwerf-Mock (Scratchpad, erweitert um `/api/programs`, `/api/logs`,
  `/api/snapshot`): Brautag einmal durchspielen, 390 px Breite ohne Querscrollen.

### Plan 5c – Gärung, Reifung, Abfüllung, Belegungsplan

> Erstellt 2026-10-14 in einer Planungssession (nur Doku). Umgesetzt wird **jede Teil-Etappe in einer
> eigenen, neuen Session** mit einem eigenen PR gegen `dev`, nach dem Merge der vorigen. Jede Session
> startet im Planmodus mit: „Setze Sud 5c-n laut `rezept-sud-editor.md` › Plan 5c um“.

**Modell und Aufwand je Teil-Etappe** (Schema wie bei Plan 5b):

| Etappe | Modell | Effort | Umfang | Planmodus | Grund |
|---|---|---|---|---|---|
| 5c-1 Rezept: Gärführung, Karbonisierung, Abfüllmenge | Opus | hoch | groß | mit Plan | Neue Rechnungen (Grünschlauchen, Zwangskarbonisierung, Kette bis zur Abfüllung, Aufnahme je Hopfenform) und neue Modellfelder. |
| 5c-1b Heiß/Kalt-Schalter | Opus | hoch | mittel | mit Plan | Kehrt die Kette um; alle Leser von `recipe.volumeL` werden umgestellt. |
| 5c-2 Belegungsplan, Gärplatz, Anstellen | Sonnet | mittel | mittel | mit Plan | Plan-Ansicht, Gärplatz-Wahl nach dem Start, Messwerte nach dem Muster aus 5b-1. |
| 5c-3 Gärprogramm, Firmware-Rampe, Stopfgaben | Opus | hoch | mittel | mit Plan | Rampe im `ProgramRunner` mit Resume nach Neustart, Generator mit Teilschritten. |
| 5c-4 Messreihen, Gärverlauf | Sonnet | hoch | mittel | mit Plan | Neue Route, Diagramm mit zwei Skalen aus Log und Messungen von Hand. |
| 5c-5 Reifung und Abfüllung, Bilanz, Index | Sonnet | mittel | mittel | mit Plan | Muster aus 5b, neue Index-Felder (kleine Firmware-Änderung). |

#### Kontext
Nach dem Brautag (5b) sind die Tabs Gärung, Reifung und Abfüllung des Suds leer. Die Rezept-Seite der
Gärung ist kaum gebaut, der Sud braucht aber ihre Sollwerte. Deshalb kommt das Rezept zuerst.
- **Rezept heute:** Eine Phase hat nur Name, Temperatur und Dauer (`Phase`). Es fehlen Rampe, Druck,
  Karbonisierung, die Hopfenform an der Gabe (es gibt sie nur am Lagerposten, `StockLot.form`), Stopfen-Tag
  und -Dauer sowie die Abfüllmenge. Der Gärung-Tab besteht aus `PhaseList` und den Zutaten.
- **Rechnungen vorhanden** in `brewMath.ts`, bisher nur vom Rechner genutzt: `residualCo2Volumes`,
  `primingSugarGrams`, `speiseVolumeL`, `recommendedRackingGravityPlato`, `ballingBeerAnalysis`. In
  `recipeWater.ts`: `restVolumeL` (nicht exportiert) und `fermenterShare`. `recipeStats` rechnet `fgPlato`
  und `abv` aus dem Endvergärungsgrad der Hefe.
- **Programme der Firmware:** keine Rampe, Werte springen beim Schrittbeginn (`ProgramRunner.h`). `holdSec`
  ist uint32, ein Schritt darf Wochen dauern. Die Zeit läuft über die Epoch (NTP), ein Neustart setzt fort.
  War das Gerät aus, endet der überfällige Schritt beim nächsten Tick, die folgenden laufen ab dann voll.
  Ohne WLAN nach einem Stromausfall steht das Programm, bis NTP die Zeit liefert. Push kennt keine
  Ruhezeiten.
- **Logs** liefern immer die ganze Session als CSV, ohne Zeitfenster und ohne Ausdünnen beim Lesen.
  Wochenlange Logs gehen, wenn das Intervall lang genug ist.
- **Dokument-Routen:** `serveJsonDocDir_` kennt kein GET eines einzelnen Dokuments, die Liste liefert alle
  Dokumente vollständig.

**Entscheidungen des Nutzers (2026-10-14)**
- **Schnitt:** sechs PRs, das Rezept zuerst.
- **Belegungsplan:** oben auf der Sude-Liste.
- **Messreihen von Hand:** neue Route je Sud.
- **Rampe:** in der Firmware, nicht als Stufen im Web.
- **Druck:** nur eine Meldung, es gibt keinen Aktor dafür.
- **Stopfgaben:** melden sich per `notify` bei Zugabe und bei Entnahme.
- **Programmende:** die letzte Temperatur halten bis „Weiter“, dann Regler aus.
- **Heiß/Kalt-Schalter:** eigener PR direkt nach 5c-1.
- **Index-Zeile:** Alkohol, scheinbarer Endvergärungsgrad und Restextrakt.
- **Dichtesensor:** neues Feld am Gärplatz (z. B. iSpindel als Remote-Sensor).
- **Dip Hopping:** kein Soll am Brautag, das Ist-Feld bleibt.
- **Gebinde:** mehrere je Sud, schon im Rezept geplant.

#### Teil-Etappen (je ein PR)

##### 5c-1 Rezept: Gärführung, Karbonisierung, Abfüllmenge
Nur Web, kein Firmware-Teil.
- **Phase:**
  - `rampDays?`: Zeit, in der die Temperatur vom vorigen Wert auf die der Phase läuft. Sie zählt zur Dauer der
    Phase, die Belegung des Gärplatzes ändert sich also nicht.
  - `pressureBar?`, sichtbar mit dem Schalter „Unter Druck vergären“ am Rezept (`pressureFermentation?: true`).
  - `PhaseList` bekommt die Spalten. Eine neue Phase startet mit 20 °C und 7 Tagen (heute 65 °C/30, ein Rest
    aus den Rasten).
- **Gabe:**
  - **Hopfenform** `form?` an Hopfenzeilen (Dolde, T90, T45, Lupulin, Extrakt). Ohne Angabe gilt die Form des
    Lagerpostens, sonst T90 (Annahme).
  - **Stopfen:** `dryHopDay?` (Tag ab Anstellen) und `dryHopDays?` (Dauer) für Hopfen und Aroma bei
    Hauptgärung und Reifung, in der schmalen Detailspalte (`IngredientCard`).
- **Karbonisierung:** `carbonation?: { method: 'krausen' | 'sugar' | 'speise' | 'forced'; targetVol; sugarType? }`.
  - Die Restkohlensäure kommt aus der höchsten Phasentemperatur. Annahme: Eine Diacetylrast liegt nach dem
    Gärende.
  - **Zucker:** Menge mit `primingSugarGrams`.
  - **Speise:** Liter mit `speiseVolumeL`; Speise-°P = Stammwürze, Vergärung aus der Hefe.
  - **Grünschlauchen:** Extrakt, bei dem geschlaucht wird (°P), neue Funktion.
  - **Zwangskarbonisierung:** Druck in bar bei Lagertemperatur, neue Funktion.
  - Beide neuen Funktionen bekommen `TODO(verify)` und Tests.
- **Gebinde im Rezept:** `bottling?.containers: { containerId; count? }[]`. Nur die letzte Zeile darf ohne
  Anzahl sein und nimmt den Rest auf. Abfüllverlust je Füllung × Anzahl; die Flaschenzahl der Restzeile folgt
  aus dem Rest.
- **Abfüllmenge** (`web/src/fermentation.ts`, rein, getestet), vorwärts vom Ausschlag:
  - **Anstellwürze** = Ausschlag − Kühlschwund − Würzeverluste ab Whirlpool (`restVolumeL`, dafür exportiert)
    − Hopfenaufnahme im Kessel (g × ml/g je Form) − Speise (+ Verschnitt im Gärbehälter).
  - **Jungbier** = Anstellwürze − Trub − Stopfhopfen (g × ml/g). Der Trub ist im Rezept eine Annahme
    (`trubLossL?`); im Sud gilt der Wert des Gärplatzes.
  - **Abgefüllt** = Jungbier + Speise − Abfüllverluste der Gebinde.
  - Die Aufnahme je Form (Kessel und Stopfen) sind Konstanten mit `TODO(verify)`. Die Werte legt der PR offen.
  - Darstellung wie im Wasser-Tab: Kennzahlen (`Stat`: Anstellwürze, Jungbier, Abgefüllt, Flaschen), Balken
    zum Verbleib der Ausschlagwürze und Aufklappbereich „Berechnung“. Eigene kleine Komponenten, der
    Wasser-Tab bleibt unberührt (`WaterBar`, `Calculation` sind auf `Water` typisiert).
- **Hinweise im Rezept:** Druck verlangt, aber kein Gärplatz ist druckfest.
- **Verifikation:** Tests der Kette (Summe der Teile), der neuen Formeln und der Aufteilung auf Gebinde;
  im Mock bei 390 px ohne Querscrollen.

##### 5c-1b Heiß/Kalt-Schalter
- `volumeBasis?: 'hot' | 'cold'`, ohne Angabe `hot`. Bei „kalt“ ist die Rezeptmenge die Anstellwürze im
  Gärbehälter (wie Brewfathers „Batch size“). Den Ausschlag rechnet die Umkehrung der Kette aus 5c-1
  zurück.
- Alle Leser von `recipe.volumeL` (rund 15 Dateien) lesen den Ausschlag über eine Funktion
  `knockOutL(recipe, bh)`.
- **Verifikation:** Hin- und Rückrechnung ergeben dieselbe Menge. Bei `hot` bleiben alle bekannten
  Testrezepte unverändert.

##### 5c-2 Belegungsplan, Gärplatz-Wahl, Anstellen
Nur Web.
- **Belegungsplan** oben auf der Sude-Liste (`web/src/occupancy.ts` rein und getestet, Komponente
  `CellarPlan`). Er liest nur `GET /api/brews`.
  - Eine Zeile je Gärplatz, dazu „ohne Gärplatz“. Sichtbar sind 8 Wochen ab der Vorwoche, mit Blättern um je
    eine Woche.
  - Läuft = belegt (voller Balken), geplant = reserviert (schraffiert), abgeschlossen grau; frei bleibt leer.
  - **Überschneidung:** Balken rot und ein Hinweis; gesperrt wird nichts (`occupancyOverlaps`).
  - Läuft ein Sud und liegt `occupiedUntil` vor heute, reicht sein Balken bis heute, markiert „überfällig“.
  - Ein Klick auf einen Balken öffnet den Sud. Das Raster scrollt nur innerhalb der Karte (390 px).
- **Gärplatz nach dem Start** (Tab Gärung):
  - Die Wahl erneuert `fermenterId` und die Kopie `frozen.fermenter`. Gesperrt, solange ein Gärprogramm
    läuft (kommt mit 5c-3).
  - Die Optionen nennen die Belegung im Zeitraum des Suds.
  - **Hinweise:** Volumen kleiner als die Anstellwürze; Druck verlangt, aber nicht druckfest; eine Phase
    braucht Kühlen oder Heizen, das die Temperierung nicht kann.
- **Anstellen:**
  - Messwerte `batchVolume` (Soll aus der Kette), `pitchGravity` (neu; Soll = Stammwürze der Anstellwürze)
    und `pitchTemp` (Soll = erste Phase), dazu die Gesamteffizienz als Ist.
  - Die Zeilen „Anstellen“ und „Dip“ mit Ist-Menge (`rebook`) und Haken.
  - **„Angestellt“** setzt `phaseStartedAt.fermentation` auf jetzt und `occupiedFrom` auf heute;
    `occupiedUntil` wandert mit. Die Zeit lässt sich korrigieren wie „Eingemaischt um“.
  - `ogActual` in der Index-Zeile stellt auf `pitchGravity` um, ohne Messung bleibt `postBoilGravity`.
- **Würze abzweigen** (Tab Würzekochen): Die Speise bekommt ihren Soll aus 5c-1; Dip bleibt nur Ist.
- **Gärführung:** die Phasen mit der aktuellen, errechnet aus Anstellzeit und Phasen. Das Programm folgt in
  5c-3.

##### 5c-3 Gärführung als Programm, Firmware-Rampe, Stopfgaben
- **Firmware: Schrittfeld `rampSec`.** Ein Regler-Ziel mit `v` läuft linear vom letzten Wert, den das
  Programm diesem Regler in einem früheren Schritt gesetzt hat, zum Ziel; ohne früheren Wert springt es.
  - Nach einem Neustart ergibt sich der Wert aus `stepStartedEpoch`, das Replay bleibt deterministisch. Eine
    Pause friert die Rampe ein.
  - Nachgeführt wird im `tick`, sobald sich der Wert um mindestens 0,05 K ändert. Im Deep Sleep nur beim
    Aufwachen; `nextEventEpoch` prüfen.
  - Betroffen sind `ProgramSteps.h/.cpp`, `ProgramRunner.cpp`, die nativen Tests, `openapi.yaml` und
    `types.ts`. Der Programm-Editor bekommt das Feld „Rampe“.
  - **Flash:** esp32dev messen (zuletzt 98,0 %).
- **Generator** `fermentationProgram(brewNumber, phases, dryHops, control?)` in `brewPrograms.ts`:
  - **Mit Regler** (`frozen.fermenter.controller`): ein Schritt je Phase mit Sollwert, `enabled` und
    `rampSec`.
  - **Stopfgaben teilen eine Phase in Teilschritte.** Fällt der Teilungspunkt in eine Rampe, läuft sie
    stückweise linear weiter. „Stopfen: 50 g Citra“ und nach der Dauer „Hopfen entnehmen: Citra“ melden sich
    per `notify`; Gaben am selben Tag stehen in einem Schritt. Die Uhrzeit der Meldung folgt dem Anstellen.
  - **Druck:** Der Phasenbeginn meldet „Spundapparat auf 1,0 bar“, die Uhr läuft weiter.
  - **Ende:** „Gärführung beendet – Weiter: Regler aus“ hält die letzte Temperatur (meist die Kaltlagerung)
    und wartet auf Freigabe; danach schaltet ein Schritt den Regler aus.
  - **Voraussetzung:** Ein ausgeschalteter Regler lässt heute seinen Aktor auf dem letzten Wert stehen
    (PLAN.md › Bugs, 2026-10-14). Am Gärplatz liefe die Kühlung nach „Regler aus“ oder „Stop“ weiter. Den
    Fehler vor 5c-3 beheben oder im Plan von 5c-3 entscheiden, wie das Programm den Aktor mit ausschaltet.
    → Entschieden 2026-10-14: eigener PR vorher (PR #107, Regler schreibt beim Aus den sicheren Wert).
  - **Ohne Regler** (Gärplatz von Hand oder ohne Temperierung) ist es ein Timer von Hand wie der
    Rasten-Timer: Jeder Phasenbeginn meldet „Auf 12 °C stellen“, mit Rampe „in 2 Tagen auf 18 °C“.
- **Tab Gärung:** Programm-Karte über `BrewTimer` (neues Feld `fermentProgramId`), mit Rückfrage vor dem
  Start, weil der Regler sofort angeht. Der Start setzt die Anstellzeit, falls sie fehlt (→ geändert
  2026-10-14: Der erste Schritt ist das Anstellen, die Zeit kommt von dessen „Weiter“). Die aktuelle Phase
  kommt aus dem Programm. „Timer abbrechen“, „Abschließen“ und „Löschen“ gehen über `dropProgram`.
  - Die Gärplatz-Wahl im Tab sperrt, solange `fermentProgramId` läuft (aus 5c-2 hierher verschoben).
- **Tab Reifung:** Stopfgaben zum Abhaken mit Uhrzeit (`addedAt`) und Ist-Menge (`rebook`), ein Haken
  „entnommen“, Notizen. (→ 2026-10-14: die Stopfgaben der Hauptgärung stehen im Tab Gärung.)

##### 5c-4 Messreihen von Hand und Gärverlauf
- **Route** `GET/PUT /api/brews/{id}/readings` → `/brewreadings/<id>.json`:
  - nur SD-Boards, 16 KB je Sud (etwa 300 Messungen);
  - geschrieben über eine Temp-Datei wie `JsonDocDir`;
  - registriert vor den Prefix-Handlern von `/api/brews/`, die die ID sonst als ungültig ablehnen;
  - `DELETE /api/brews/{id}` löscht die Messreihen mit;
  - native Tests, `openapi.yaml`, README-Tabelle, `types.ts`.
- **Modell:** `{ id, readings: { at, kind: 'gravity' | 'brix' | 'temp' | 'ph', v, note? }[] }`. Brix wird roh
  gespeichert und mit der Stammwürze umgerechnet (`apparentExtractFromRefractometer`). Die Sud-Sicherung
  nimmt die Messreihen mit.
- **Karte „Messungen“** in den Tabs Gärung und Reifung: eintragen (Zeit vorbelegt, Dichte über
  `GravityInput`), Liste, löschen.
- **Dichtesensor** am Gärplatz (`densitySensor?`, Dialog im Gärkeller), mit Hinweis, wenn er nicht in °P oder
  SG misst.
- **Gärverlauf** (`FermentCourse`, uPlot, x = Tage ab Anstellen):
  - Soll aus Phasen und Rampen;
  - Ist-Temperatur und Sollwert des Reglers aus dem Log. Der Sud merkt sich `fermentLogId` getrennt von
    `logId` (Maischen); vorgeschlagen ist das Log mit dem Fühler des Gärplatzes;
  - Dichte aus dem Log (Dichtesensor);
  - Messungen von Hand als Punkte;
  - zwei Skalen, °C und °P.
- Hinweis bei kurzem Log-Intervall, weil die ganze Session geladen wird (PLAN.md).

##### 5c-5 Reifung und Abfüllung, Bilanz, Index
- **Messwerte:**
  - `finalGravity`: Restextrakt, Soll = `fgPlato` des Rezepts; vorgeschlagen ist die letzte Messung.
  - `maxTempAfter`: Höchsttemperatur nach dem Gärende, für die Restkohlensäure.
  - `bottledVolume`: Soll aus der Kette.
- **Karbonisierung neu berechnet** mit Ist-Jungbier, Restextrakt und Temperatur. Bei Speise steht dabei, ob
  die abgezweigte Menge reicht.
- **Gebinde:** Zeilen Gebinde × Anzahl, vorbelegt aus dem Rezept. Abfüllzeilen (Zucker, Abfüllhefe) mit
  `rebook` und Haken.
- **„Abgefüllt“** setzt `occupiedUntil` auf heute und `phaseStartedAt.bottling`.
- **Bilanz:** Volumen Soll/Ist entlang der Kette; Maischeeffizienz, Sudhausausbeute, Gesamteffizienz;
  Alkohol und Endvergärungsgrad.
- **Index:** `brewSummaryLine` bekommt `abvPct`, `attenuationPct` und `fgPlato` (Firmware-Test, `openapi.yaml`,
  `SUMMARY_FIELDS`). `withResults` füllt sie und `bottledL`. Der Rezept-Tab „Sude“ bekommt die Spalten.

##### Verkostung (Stand 2026-10-16)
- **Entscheidungen des Nutzers:** mehrere Verkostungen je Sud, jede mit Zeitpunkt (Jungbier, Flasche nach zwei und
  nach sechs Wochen); eigener Tab „Verkostung“ nach der Abfüllung; Auswahl von Begriffen statt Punkten, nur der
  Genuss-Faktor ist eine Zahl (1 bis 5 Sterne); keine Anzeige in der Sudliste (kein Eingriff in den Firmware-Index).
  Eine Note für die „technische Ausführung“ gibt es bewusst nicht.
- **Ablage:** eigenes Dokument je Sud, `/brewtasting/<id>.json` über `GET/PUT /api/brews/<id>/tasting`, nach dem
  Muster der Messungen von Hand: Der Sud bleibt unter 16 KB, das Dokument geht mit dem Sud weg und in dieselbe
  Sicherung (Schlüssel `tasting`; ältere Sicherungen ohne ihn lassen sich einspielen). Etwa 12 Verkostungen, die bis
  zu den Notizen ausgefüllt sind (je 1,2 KB), passen in 15 000 Byte.
- **Aufbau** (`web/src/brewTasting.ts`), nach den fünf Phasen einer Verkostung, jede mit Notizfeld:
  1. *Aussehen:* Farbe, Trübung, Schaummenge, Schaumstruktur, Schaumhaltbarkeit. Bei „Kein Schaum“ sind Struktur und
     Haltbarkeit gesperrt (ein gespeicherter Wert bleibt).
  2. *Geruch:* Aroma-Begriffe (Mehrfachauswahl).
  3. *Antrunk:* Rezenz (Kohlensäure-Empfinden), erster Geschmackseindruck.
  4. *Haupttrunk:* Körper, Geschmacksbalance (malzbetont, ausgewogen, hopfenbetont, säuerlich), Textur (Mehrfachauswahl).
  5. *Nachtrunk / Abgang:* Intensität und Qualität der Bittere, retronasaler Nachhall (dieselbe Aroma-Liste wie beim
     Geruch), Nachhall-Dauer, Alkoholwahrnehmung, Trinkbarkeit.

  Danach *Fehlaromen* mit Stufe (leicht, deutlich, stark) und *Gesamteindruck* (Komplexität, Stilgerechtigkeit,
  Genuss-Faktor in Sternen). Aromen werden nur einmal beim Geruch und einmal als Nachhall abgefragt; Antrunk und
  Haupttrunk fragen Empfindungen ab, keine Aromen. Die zweite Balance-Achse süß/trocken entfiel (sie steckt in
  „Malzbetont (süß)“, „Schlank“ und „Knackig“).
- **Trübung:** eine Skala von glanzfein bis opak. „Opak“ ist das obere Ende der Trübung; für dunkle Biere, bei denen
  sich Trübung nicht von der Farbe unterscheiden lässt, gibt es „nicht beurteilbar (zu dunkel)“. Die Trübungsart (Hefe,
  Kälte, Hopfen, Eiweiß) wird nicht gesondert erfasst.
- **Begriffe** (`web/src/tastingVocab.ts`): eigene deutsche Begriffe in der Art des Bier-Aromarads, gruppiert
  (Getreide & Malz, Karamell & Süße, Röstig & Rauch, Fruchtig, Hopfig & blumig, Würzig, Sonstiges). Fehlaromen in fünf
  Gruppen mit Beschreibung und häufigen Ursachen. Viele Auswahlfelder tragen einen Hinweis (typische Stile, was gemeint
  ist), der unter der gewählten Option steht. Kein Text der BJCP (Urheberrecht, das Repo ist öffentlich). Gespeichert
  werden stabile Kennungen, nicht die Bezeichnungen.
- **Oberfläche:** `TastingTab` mit einer Karte je Verkostung (neueste oben, „x Tage nach der Abfüllung“), `TastingForm`
  mit einklappbaren Abschnitten, `ChipGroup` für die Auswahl, `StarRating` für den Genuss-Faktor. Gespeichert wird von
  selbst, eine Sekunde nach der letzten Änderung und beim Verlassen des Tabs.

#### Doku und Verifikation je Teil-Etappe
- **Prüfung:** Tests für neue Rechnungen und Generatoren, `pnpm typecheck`, `pnpm test`, `pnpm build`;
  `npx @redocly/cli lint` bei Routen- oder Feldänderungen. Bei Firmware `pio test -e native` und `pio run`
  für `lilygo_t_display_s3_amoled` und `esp32dev`.
- **Browser:** Wegwerf-Mock im Scratchpad gegen das `dist` des Worktrees (`pnpm build`, nicht `build:tars`),
  390 px ohne Querscrollen.
- **Doku:** dieses Doc mit „Stand 5c-n“, `PLAN.md` (Erledigtes ersatzlos raus, Neues rein), `SESSION.md`.
- **Gerät:** Alles am Gerät gilt als „nicht geprüft“. Ein Lauf am LilyGo, der Regler oder Aktoren schaltet,
  nur nach Rückfrage, danach alles auf den vorigen Stand.

## Offen / später

- **Mobile-Ansichten:** Die vorhandenen Screens sind veraltet (altes Stilfeld, keine Pumpen, keine
  Gärplatz-Wahl).
- **Stil-Auswahl:** bespricht der Nutzer noch, dazu die Datenquelle der Stiltabelle.
- **Läutern** im Tab Maischen (Dekoktion seit 3d).
- **Datenmodell und Ablage der Sude** auf SD bzw. LittleFS. Die 256-KB-Partition der LittleFS-Boards begrenzt
  Sude, Messreihen und Zutatenlisten. Rezepte liegen seit 2026-10-04 einzeln auf der SD
  (`/recipes/<id>.json`, `/api/recipes`) und gibt es nur auf SD-Boards.
- **Zutaten-Datenbanken** (Malz, Hopfen, Hefen, Stile): mitgeliefert oder vom Nutzer gepflegt?
- **Berechnungen:** Auf `web/src/brewMath.ts` aufbauen. Mehrere Konstanten dort sind laut PLAN.md noch
  unverifiziert. Die Definitionen der Effizienzen stehen seit 3b fest (Rezept › Effizienz); der Rechner
  rechnet seine Sudhausausbeute noch auf das Potenzial statt auf das Gewicht. Dazu kommen Morey (Farbe),
  Tinseth (IBU), die pH-Schätzung und der Rest-CO₂.
