# Rezept- und Sud-Editor — Konzept

Stand: 2026-10-07. Umgesetzt sind Rezepte (Liste, Editor, Ablage auf der SD), das Sudhaus-Modell der
Brauanlage (Etappe 1), die Wassermengen (Etappe 2a), die Aufbereitung von Hand mit High Gravity (Etappe
2b-1) und die pH-Modelle (2b-2); Automatik (2b-3), Maischen, Versionen, Gärkeller und Sud folgen in dieser Reihenfolge. Das UI ist
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
  Maische und Würze seit Etappe 2b-2 (2026-10-07, `web/src/mashPh.ts`). Es folgt die Automatik mit
  Zielprofilen (2b-3).
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
  „einfüllen x l“, wenn die Einfüllmenge abweicht), Schalter „Mit Nachguss“, Eingaben (Hauptguss-Verhältnis,
  Nachguss-Temperatur, Verdampfung, Treberverlust) und farbigem Balken (Gesamtwasser aufgeteilt in
  Ausschlag, Verdampfung, Treber, Totraum/Transfer). Die Rechnung steht mit Herkunft jeder Zahl (Rezept
  bzw. Sudhaus) in einem Aufklappbereich „Berechnung“, standardmäßig zu.
- Toträume, Transferverluste, Verdampfung und Treberverlust kommen als Vorgabe aus dem Sudhaus.
  **Verdampfung und Treberverlust** lassen sich pro Rezept überschreiben; der Platzhalter zeigt den
  Sudhaus-Wert, „Sudhaus-Wert“ nimmt die Überschreibung zurück.

### Maischen und Würzekochen
- **Maischen** (Tab): Kopfkarte, Zutaten (Maische), Maischeplan, Temperaturverlauf.
  - Maische-Effizienz (Vorgabe aus dem Sudhaus)
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
    - **Dekoktion:** vorgemerkt, siehe unten.
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
    Schritt-Arten (Zubrühen, Einmaischen) und vordefinierte Rasten.
    „Profile“ öffnet den Dialog Maischprofile, der Pfeil daneben lädt ein Profil direkt.
  - **Dialog Maischprofile:** Liste (eigene und mitgelieferte) und Editor mit Name, Verfahren, Beschreibung
    und Rasten (Temperatur, Dauer). Aufheizzeiten gehören nicht zum Profil, sie rechnet das Rezept mit der
    Heizrate des Sudhauses.
  - **Mitgelieferte Profile** sind schreibgeschützte Vorlagen; geändert wird eine Kopie (Duplizieren).
- **Verfahren (Infusion/Dekoktion)** hat keinen eigenen Schalter mehr. Es ergibt sich aus den Schritten im
  Maischeplan: Enthält er einen Schritt Dekoktion, ist es ein Dekoktionsverfahren. Das Sudhaus bestimmt,
  was möglich ist und wie geheizt wird:
  - **Maischeheizung** aus dem Schritt Maischen des Sudhauses: direkt beheizt, HERMS, Kettle-RIMS, RIMS
    oder Aufguss (`heatingOf` in `web/src/brewhouse.ts`).
    Bei Aufguss rechnet das Rezept Zubrühmengen statt Heizzeiten.
  - **Dekoktion möglich**, wenn es neben dem Maischbehälter einen zweiten Behälter mit eigener Heizquelle
    gibt, der die Teilmaische kochen kann. Das wird aus dem Sudhaus abgeleitet, einen Schalter gibt es
    nicht. Sonst ist die Schritt-Art Dekoktion im Rezept ausgegraut, mit Hinweis aufs Sudhaus.
  - Wechselt das Rezept auf ein Sudhaus ohne Dekoktion, warnt es und bietet ein Infusionsprofil an.
- **Kopfkarte Maischen:** Maische-Effizienz, Malztemperatur, Heizrate (nur lesbar, aus dem Sudhaus).
  Die Einmaischtemperatur steht im Plan beim Schritt Einmaischen, die berechnete Hauptguss-Temperatur
  beim Schritt Wasser vorlegen.
- **Würzekochen** (Tab): Karte „Kochen & Whirlpool“ mit Kochdauer, Nachisomerisierung, Whirlpool-Temperatur
  und -Dauer, darunter eine Zeitleiste der Gaben (Läutern/Vorderwürze · Kochen · Nachisomerisierung ·
  Whirlpool). Danach die Zutaten (Vorderwürze, Kochen, Whirlpool) und der Hinweis, wenn das Sudhaus keinen
  Hop Back hat.
- **Offen:** Läutern (noch keine Felder, inkl. Fly/Batch Sparge), Dekoktion als Schritt-Art: Teilmaische
  ziehen (Anteil, dick/dünn), eigene Rasten in der Würzepfanne, kochen, zurückführen mit berechneter
  Mischtemperatur; im Temperaturverlauf als zweite Linie. Teilschüttungen in Maischprofilen.
- **Ausgangstemperatur des Hauptgusses** für die Heizzeit ist die Leitungswassertemperatur der
  Brauerei-Ebene (statt der früheren Annahme 14 °C); im Sud gilt der am Brautag gemessene Wert.

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

Ebenfalls dort steht das **pH-Modell** (seit 2b-2), eines für alle Rezepte: Troester (pH aus Malzdaten,
Vorgabe) oder Kolbach (Restalkalität nach Bierfarbe, ohne pH). Siehe Wasser › Aufbereitung.

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
- **Allgemein:** Name, Beschreibung, Maische-Effizienz, Abkühlschwund (Vorgabe 4 %).
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
  Leitungswassertemperatur, Haupt- und Nachgussmenge, Temperaturen, pH, Pfannevoll, Stammwürze und pH vor
  und nach dem Kochen, Ausschlagmenge, Anstelltemperatur). Das Sudhaus verknüpft jede mit einem Sensor oder
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
- **Läutern und Dekoktion** im Tab Maischen.
- **Datenmodell und Ablage der Sude** auf SD bzw. LittleFS. Die 256-KB-Partition der LittleFS-Boards begrenzt
  Sude, Messreihen und Zutatenlisten. Rezepte liegen seit 2026-10-04 einzeln auf der SD
  (`/recipes/<id>.json`, `/api/recipes`) und gibt es nur auf SD-Boards.
- **Zutaten-Datenbanken** (Malz, Hopfen, Hefen, Stile): mitgeliefert oder vom Nutzer gepflegt?
- **Berechnungen:** Auf `web/src/brewMath.ts` aufbauen. Mehrere Konstanten dort sind laut PLAN.md noch
  unverifiziert, darunter die Definitionen der Effizienzen. Dazu kommen Morey (Farbe), Tinseth (IBU), die
  pH-Schätzung und der Rest-CO₂.
- **Gärführung als Programm** an den Gärplatz-Regler übertragen, über die vorhandenen Programme/Profile.
