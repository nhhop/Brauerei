# Rezept- und Sud-Editor — Konzept

Stand: 2026-10-09. Umgesetzt sind Rezepte (Liste, Editor, Ablage auf der SD), das Sudhaus-Modell der
Brauanlage (Etappe 1), die Wassermengen (Etappe 2a), die Aufbereitung von Hand mit High Gravity (Etappe
2b-1), die pH-Modelle (2b-2), die Automatik mit Zielprofilen (2b-3), der Maischeplan (3a), die
Effizienz-Kette (3b), die Maischprofile (3c) und die Dekoktion (3d); Versionen, Gärkeller und Sud folgen in dieser Reihenfolge. Das UI ist
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
  „Nur Unterschiede“ blendet gleiche Zeilen aus. Mit „vX in den Entwurf übernehmen“ holt man eine ältere
  Version zurück.
- Der Abschnitt „Versionen“ steht auf der Übersicht, nicht im Tab Sude.
- **Speichern** erfolgt **explizit** über einen Knopf, der ungespeicherte Änderungen mit einem Punkt anzeigt.
  Es gibt kein automatisches Speichern.
- **„⋯“-Menü:** Duplizieren, Brauzettel drucken, Exportieren (BeerXML, JSON), bei fertigen Rezepten
  „Neue Version als Entwurf“, Löschen.
- **Offen:** Was passiert beim Öffnen einer älteren Version? Vorschlag: nur ansehen, nicht bearbeiten.

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

**Mengen und Anteile beim Vergärbaren**, ohne Modus-Schalter:
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

  Eigene Zielprofile legt man in Anlage › Wasserprofile mit dem Haken „Zielprofil“ an.
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
- **Ort** je Rezept: Pfanne bei Kochende oder Gärbehälter. **Menge und Stammwürze** hängen voneinander ab;
  was zuletzt geändert wurde, führt, das andere wird berechnet. Ein Ortswechsel behält die Menge.
- **Pfanne:** Ausschlagmenge und Stammwürze des Rezepts gelten nach dem Verschnitt. Die Pfanne kocht
  Ausschlag − Verschnitt bei entsprechend höherer Stammwürze; die Rückrechnung der Wassermengen beginnt
  dort. Passt Pfannevoll nicht in den Kochbehälter, nennt ein Hinweis den Verschnitt, mit dem es passt
  („übernehmen“).
- **Gärbehälter:** Der Ausschlag bleibt unverdünnt. Im Gärbehälter kommt Ausschlag − Kühlschwund − Totraum
  der Pfanne − Transferverluste ab Whirlpool an (ohne Sudhaus der ganze Ausschlag, mit Hinweis), dazu der
  Verschnitt. Die Stammwürze folgt aus der Massenbilanz. Hopfenaufnahme und Trub kommen mit dem Gärung-Tab.
- **Kennwerte:** Stammwürze ist die nach dem Verschnitt. Die Bittere rechnet Tinseth mit Menge und
  Stammwürze der Pfanne und verdünnt das Ergebnis; beim Gärbehälter verdünnt sich auch die Farbe.
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
  - **Offen (mit dem Gärung-Tab, Entscheidung 2026-10-09):** ein Schalter, ob die Menge im Rezept der
    Ausschlag heiß oder die Anstellwürze kalt im Gärbehälter ist (wie Brewfathers „Batch size“). Bei „kalt“
    rechnet das Rezept den Ausschlag aus Anstellwürze, Verlusten nach dem Kochen und Schwund zurück.
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
  bzw. Sudhaus) in einem Aufklappbereich „Berechnung“, standardmäßig zu.
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
  - Die Absorption von Stopfhopfen (0,6 l/100 g im Entwurf) ist ein ungeprüfter Platzhalter.
  - **Hopfenaufnahme** im Kessel: etwa 5 ml/g, je Produkt weniger. Dafür bekommt die Hopfengabe ein Feld
    Form (Dolde, T90, T45, Lupulin, Extrakt), die Aufnahme in ml/g ist eine Konstante je Form.

### Sude (Tab im Rezept)
- Knopf „Neuer Sud aus diesem Rezept“, bei Entwürfen gesperrt.
- Tabelle der Sude mit Version, Status, Stammwürze Soll/Ist, Maische- und Gesamteffizienz und abgefüllter
  Menge.
- Diagramm der Effizienz über die Sude.

## Anlage (Einstellungen › Brauanlage)

Die Anlage ist in **Sudhaus** und **Gärkeller** geteilt. Die meisten Brauer haben ein Sudhaus, aber oft
mehrere Gärplätze, sodass mehrere Sude gleichzeitig aktiv sein können.

Über den Sudhäusern steht die **Brauerei**: Malztemperatur und Leitungswassertemperatur hängen am Standort,
nicht an der Anlage, und werden deshalb einmal für alle Sudhäuser gepflegt. Sie sind Vorgabe für die
Rezept-Rechnungen und Vorbelegung im Sud; die Werte vom Brautag trägt der Sud als Messung ein.

Ebenfalls auf Brauerei-Ebene stehen die **Wasserprofile** (seit 2b-1): Analysen mit Ca, Mg, Na, K, Cl, SO₄,
HCO₃ in mg/l, optional pH und Notiz, als Liste mit Dialog. Eingabehilfen rechnen KS4,3 (× 61,02) oder
Karbonathärte (°dH × 21,8) in HCO₃ um, Calcium- und Magnesiumhärte (°dH × 7,14 bzw. × 4,34) in Ca und Mg;
weicht die Ionenbilanz um mehr als 10 % ab, erscheint ein Hinweis. VE-Wasser ist fest eingebaut und wird
nicht gespeichert. Das **Standardwasser** ist das Ausgangswasser von Rezepten, die keines wählen; ohne Wahl
gilt das erste Profil, ohne Profil VE-Wasser. Rezepte lesen es beim Rechnen, ändert es sich, rechnen auch
bestehende Rezepte ohne eigene Wahl damit.

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

Ein Wasserprofil mit dem Haken **Zielprofil** (seit 2b-3, `target: true`) ist kein Ausgangswasser: Es fehlt in
der Auswahl der Ausgangswässer und des Standardwassers und dient nur dem Vergleich und der Automatik im
Wasser-Tab (siehe Wasser › Aufbereitung, „Ziel“). Die mitgelieferten Zielprofile sind fest eingebaut.

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
- Gärplätze mit Name, Bauart, Volumen, Trubverlust, druckfest bis, Temperierung und verknüpftem
  Regler/Gerät, oft auf einem anderen Board.
- Belegungsplan über mehrere Wochen mit belegt, frei und reserviert für geplante Sude.
- Gebinde für die Abfüllung: Flasche/Keg, Größe, Anzahl, Abfüllverlust, druckfest bis.

## Sud

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
- **Pumpen in den Sud-Tabs:** Die Transfers aus dem Sudhaus erscheinen in ihrem Tab und lassen sich
  **steuern** (Start/Stopp) oder zeigen nur den **Status**, mit Laufzeit und Menge. Die Besitzregeln wie in
  `web/src/ownership.ts` gelten: Eine Pumpe, die gerade einem Regler oder Programm gehört, lässt sich nicht
  schalten.

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
- **Gärführung als Programm** an den Gärplatz-Regler übertragen, über die vorhandenen Programme/Profile.
