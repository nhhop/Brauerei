# Rezept- und Sud-Editor — Konzept

Stand: 2026-10-02. Noch nicht umgesetzt. Das UI ist als Design-Canvas entworfen:
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
Übersicht · Zutaten · Wasser · Brautag · Gärung · Sude (Anzahl).
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
Zwei Ansichten derselben Daten. Umgeschaltet wird über „Gruppieren: Art | Prozess“, klein und rechtsbündig
über der ersten Karte. Es gibt keinen Kopfbereich mit Kennwerten: Stammwürze, IBU und EBC zeigen die
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
  Die Whirlpool-Temperatur steht auf der Brautag-Seite; die Würzemenge fürs Dip Hopping entfällt.

**Nach Art**, fünf Arten:
1. **Vergärbares** (Malz, Rohfrucht, Zucker, Extrakt) — nach Menge sortiert, ohne Ziehgriffe.
2. **Hopfen** — in Prozessreihenfolge. α-Säure und Öl stammen aus der Sortenliste und lassen sich **je Gabe**
   anpassen. Formen: Dolde, Pellets T90, Pellets T45, Lupulin-Konzentrat, Extrakt.
3. **Hefen & Kulturen** — Saccharomyces (ober-/untergärig, Kveik), Brettanomyces, Milchsäurebakterien,
   Mischkulturen.
4. **Aromazutaten** — Früchte, Gewürze, Kräuter, Holz, Kakao, Kaffee.
5. **Hilfsstoffe** — Wasseraufbereitung (Salze, Säuren), Klärung, Hefenahrung, Enzyme.

**Nach Prozessschritt.** Die Karten entsprechen den Sud-Phasen, damit jede Gruppe genau einem Sud-Tab
zugeordnet ist:

| Karte | Gruppen |
|---|---|
| Maischen | Hauptguss · Maische (Säure nach pH-Messung) · Nachguss |
| Würzekochen | Vorderwürze · Kochen · Whirlpool / Hop Stand · (Hop Back, nur wenn das Sudhaus einen hat) |
| Gärung | Anstellen (Hefe, Dip Hopping) · Hauptgärung |
| Reifung | Stopfen, Schönung, zweite Kultur |
| Abfüllung | Karbonisierung (Speise erscheint hier schreibgeschützt) |

Darstellung in der Prozess-Ansicht:
- Dieselben Eingabe- und Ergebnisfelder wie nach Art, ohne Spalte Zeitpunkt.
- Die Art steht als Markierung in der zweiten Spalte. Es gibt keine zusätzliche Gruppierungsebene je Art.
- Die Kopfzeile des Prozessschritts trägt die Spaltenköpfe. Sie richten sich nach der ersten Zutatenart
  im Schritt; leere Schritte haben keine.
- Ganz rechts steht „+ Zutat“ in der verbreiterten Spalte des Löschen-Knopfs.
- Reihenfolge rechts: Menge · schmale Spalte (Anteil, Dauer bzw. Details) · zwei Ergebnisspalten. Die
  Details der Hilfsstoffe bleiben in der schmalen Spalte, weil in gemischten Schritten Öl/IBU darüber
  stehen können.

Fachliche Festlegungen:
- **Flameout:** keine eigene Gruppe, sondern Kochen mit 0 min.
- **Whirlpool und Hop Stand** sind eine Gruppe. Temperatur und Dauer kommen aus dem Tab Brautag.
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
| Hilfsstoffe | Hauptguss, Maische, Maische nach pH-Messung, Nachguss, Kochen, Anstellen, Reifung |

Der Auswahl-Dialog für Zutaten ist für alle fünf Arten gleich aufgebaut: Suche, Filter-Chips je Art,
Liste und Detailansicht.

### Wasser
- Aufbereitung in drei Spalten: **Hauptguss · Maische · Nachguss**.
- **Säure für die Maische** wird nach dem Einmaischen und der pH-Messung gegeben, nicht in den Hauptguss.
  Der Sud schlägt die Menge aus dem gemessenen pH neu vor.
- **Salze und Säuren** sind dieselben Einträge wie unter Zutaten › Hilfsstoffe und lassen sich **an beiden
  Stellen bearbeiten**.
- **Später hierher:** alle Werte für die Wassermenge, also Treberverlust, Verdampfungsrate, Würzeverlust,
  angenommener Trubverlust im Gärbehälter und die Volumenbilanz Gesamtwasser → Pfannevoll → Ausschlag →
  Anstellwürze. Die Werte kommen aus dem Sudhaus und lassen sich pro Rezept überschreiben. Sie wurden aus der
  Übersicht entfernt, im Wasser-Tab aber noch nicht neu angeordnet.

### Brautag (vorher „Maischen“)
- **Maischen:**
  - Verfahren (Infusion/Dekoktion) und Maische-Effizienz (Vorgabe aus dem Sudhaus)
  - Einmaischen (Temperatur, Malztemperatur, berechnete Hauptgusstemperatur)
  - Maischeplan mit Rasten, aus Vorlagen oder frei; die Reihenfolge lässt sich per Ziehgriff ändern
- **Würzekochen:** Kochdauer, Nachisomerisierung, Whirlpool-Temperatur und -Dauer.
- **Offen:** Läutern (noch keine Felder), Darstellung der Dekoktion (Teilmaischen).

### Gärung
- Hefe nur zur Ansicht; bearbeitet wird sie in den Zutaten.
- Gärführung als Phasen mit Temperatur, Dauer, Rampe und optional Druck (Schalter „Unter Druck vergären“).
- Karbonisierung: Grünschlauchen, Zucker, Speise oder Zwangskarbonisierung. Bei Speise wird die Restmenge
  CO₂ aus der Höchsttemperatur nach Gärende berechnet.

### Sude (Tab im Rezept)
- Knopf „Neuer Sud aus diesem Rezept“, bei Entwürfen gesperrt.
- Tabelle der Sude mit Version, Status, Stammwürze Soll/Ist, Maische- und Gesamteffizienz und abgefüllter
  Menge.
- Diagramm der Effizienz über die Sude.

## Anlage (Einstellungen › Brauanlage)

Die Anlage ist in **Sudhaus** und **Gärkeller** geteilt. Die meisten Brauer haben ein Sudhaus, aber oft
mehrere Gärplätze, sodass mehrere Sude gleichzeitig aktiv sein können.

### Sudhaus
- Profile, z. B. „Hobbybrauanlage 20 l (HERMS)“; Rezepte wählen eins davon.
- Allgemein: Vorgabe für die Maische-Effizienz, Volumenschwund beim Abkühlen, Malztemperatur.
- Gefäße:
  - HLT (Heißwasser)
  - Maischen & Läutern (getrennt oder kombiniert; Totraum, Treberverlust, Heizrate)
  - Würzepfanne (Verdampfung, Würzeverlust, Whirlpool in der Pfanne)
  - Hop Back (an/aus)

  Jedes Gefäß lässt sich mit einem Regler oder Aktor der Registry verknüpfen.
- **Keine freie Zuordnung von Rollen zu Gefäßen,** etwa „Hauptguss wird im Maischebottich erhitzt“. Das
  ist bewusst zurückgestellt, weil es eigene Konfigurationslogik braucht.
- **Pumpen & Transfers:** je Transfer Weg (von → nach), Antrieb (Aktor, Schwerkraft oder von Hand),
  Durchfluss, Verlust und der Sud-Tab, in dem er erscheint. Ein eigener allgemeiner Transferverlust entfällt.

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
- **Wasser-Tab:** Volumenwerte und Volumenbilanz unterbringen (siehe oben).
- **Läutern und Dekoktion** im Tab Brautag.
- **Rollen frei auf Gefäße verteilen** (siehe Sudhaus).
- **Datenmodell und Ablage** auf SD bzw. LittleFS. Die 256-KB-Partition der LittleFS-Boards begrenzt Rezepte,
  Sude, Messreihen und Zutatenlisten.
- **Zutaten-Datenbanken** (Malz, Hopfen, Hefen, Stile): mitgeliefert oder vom Nutzer gepflegt?
- **Berechnungen:** Auf `web/src/brewMath.ts` aufbauen. Mehrere Konstanten dort sind laut PLAN.md noch
  unverifiziert, darunter die Definitionen der Effizienzen. Dazu kommen Morey (Farbe), Tinseth (IBU), die
  pH-Schätzung und der Rest-CO₂.
- **Gärführung als Programm** an den Gärplatz-Regler übertragen, über die vorhandenen Programme/Profile.
