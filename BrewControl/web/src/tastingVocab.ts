// The words a tasting is made of (brewTasting.ts stores their ids, never the
// German labels). Own terms in the manner of the beer flavour wheel
// (Meilgaard): groups on the first level, single descriptors on the second.
// Fixed in the code; adding a word is adding a line here.

export interface Choice { id: string; label: string; hint?: string }
export interface Descriptor extends Choice { group: string }
export interface Group { id: string; label: string }

// ── Aroma descriptors (smell and aftertaste) ────────────────────────────────────────────────
export const AROMA_GROUPS: Group[] = [
  { id: 'grain', label: 'Getreide & Malz' },
  { id: 'caramel', label: 'Karamell & Süße' },
  { id: 'roast', label: 'Röstig & Rauch' },
  { id: 'fruit', label: 'Fruchtig' },
  { id: 'hop', label: 'Hopfig & blumig' },
  { id: 'spice', label: 'Würzig' },
  { id: 'other', label: 'Sonstiges' },
];

export const AROMA: Descriptor[] = [
  { id: 'grain', label: 'Getreide', group: 'grain' },
  { id: 'malty', label: 'Malzig', group: 'grain' },
  { id: 'bread', label: 'Brotkruste', group: 'grain' },
  { id: 'biscuit', label: 'Keks', group: 'grain' },
  { id: 'honey', label: 'Honig', group: 'grain' },
  { id: 'wort', label: 'Würzig-süß (Würze)', group: 'grain' },

  { id: 'caramel', label: 'Karamell', group: 'caramel' },
  { id: 'toffee', label: 'Toffee', group: 'caramel' },
  { id: 'burnt-sugar', label: 'Gebrannter Zucker', group: 'caramel' },
  { id: 'molasses', label: 'Melasse', group: 'caramel' },

  { id: 'toast', label: 'Toast', group: 'roast' },
  { id: 'roast', label: 'Geröstet', group: 'roast' },
  { id: 'coffee', label: 'Kaffee', group: 'roast' },
  { id: 'cocoa', label: 'Kakao', group: 'roast' },
  { id: 'chocolate', label: 'Schokolade', group: 'roast' },
  { id: 'smoke', label: 'Rauch', group: 'roast' },
  { id: 'burnt', label: 'Verbrannt', group: 'roast' },

  { id: 'citrus', label: 'Zitrus', group: 'fruit' },
  { id: 'apple-pear', label: 'Apfel / Birne', group: 'fruit' },
  { id: 'banana', label: 'Banane', group: 'fruit' },
  { id: 'stone-fruit', label: 'Steinobst', group: 'fruit' },
  { id: 'berry', label: 'Beeren', group: 'fruit' },
  { id: 'tropical', label: 'Tropenfrucht', group: 'fruit' },
  { id: 'melon', label: 'Melone', group: 'fruit' },
  { id: 'dried-fruit', label: 'Trockenfrüchte', group: 'fruit' },

  { id: 'floral', label: 'Blumig', group: 'hop' },
  { id: 'grassy', label: 'Grasig', group: 'hop' },
  { id: 'herbal', label: 'Kräuterig', group: 'hop' },
  { id: 'resin', label: 'Harzig / Kiefer', group: 'hop' },
  { id: 'earthy', label: 'Erdig', group: 'hop' },
  { id: 'woody', label: 'Holzig', group: 'hop' },

  { id: 'pepper', label: 'Pfeffer', group: 'spice' },
  { id: 'clove', label: 'Nelke', group: 'spice' },
  { id: 'coriander', label: 'Koriander', group: 'spice' },
  { id: 'vanilla', label: 'Vanille', group: 'spice' },
  { id: 'cinnamon', label: 'Zimt', group: 'spice' },
  { id: 'anise', label: 'Anis', group: 'spice' },

  { id: 'nut', label: 'Nuss', group: 'other' },
  { id: 'yeast', label: 'Hefe', group: 'other' },
  { id: 'alcohol', label: 'Alkohol', group: 'other' },
  { id: 'acidic', label: 'Säuerlich', group: 'other' },
  { id: 'oak', label: 'Eiche / Fass', group: 'other' },
  { id: 'funky', label: 'Funky / stallig', group: 'other' },
  { id: 'mineral', label: 'Mineralisch', group: 'other' },
  { id: 'neutral', label: 'Neutral / sauber', group: 'other' },
];

// ── Off-flavours ─────────────────────────────────────────────────────────────────
export interface Fault extends Descriptor {
  smell: string;   // what it is like
  cause: string;   // the usual reasons
}

export const FAULT_GROUPS: Group[] = [
  { id: 'fermentation', label: 'Gärung' },
  { id: 'brewhouse', label: 'Würze & Maische' },
  { id: 'infection', label: 'Infektion & Hefe' },
  { id: 'oxidation', label: 'Oxidation & Alterung' },
  { id: 'other', label: 'Sonstiges' },
];

export const FAULTS: Fault[] = [
  { id: 'diacetyl', label: 'Diacetyl', group: 'fermentation', smell: 'Butter, Butterscotch, Popcorn; ein „öliger“ Belag im Mund',
    cause: 'Reifung zu kurz oder zu kalt gestartet, Hefe zu früh abgetrennt; auch eine Infektion mit Pediokokken' },
  { id: 'acetaldehyde', label: 'Acetaldehyd', group: 'fermentation', smell: 'Grüner Apfel, frischer Kürbis, Latex',
    cause: 'Zu junges Bier, Gärung zu früh beendet, Oxidation des Alkohols' },
  { id: 'sulfur', label: 'Schwefel', group: 'fermentation', smell: 'Faule Eier, abgebranntes Streichholz',
    cause: 'Junges Bier und gestresste Hefe; bei Lagerhefen kurz nach der Hauptgärung normal, verfliegt in der Reifung' },
  { id: 'fusel', label: 'Fuselalkohole', group: 'fermentation', smell: 'Heißer Alkohol, Lösungsmittel, Klarer',
    cause: 'Zu warme Gärung, zu viel Hefe oder zu wenig Sauerstoff beim Anstellen' },
  { id: 'esters-high', label: 'Zu viele Ester', group: 'fermentation', smell: 'Überreife Banane, Nagellackentferner, Birnendrops',
    cause: 'Gärtemperatur zu hoch, hohe Stammwürze, zu wenig Hefe' },
  { id: 'green', label: 'Jungbier / „grün“', group: 'fermentation', smell: 'Grasig, grüner Apfel, unrund, vermischte Gärnoten',
    cause: 'Zu früh abgefüllt oder angestochen; braucht mehr Reifezeit' },
  { id: 'unfermented', label: 'Unvergoren-süß', group: 'fermentation', smell: 'Süßlich nach Würze, klebrig',
    cause: 'Gärung stecken geblieben, zu wenig oder schwache Hefe, hohe Maischtemperatur' },

  { id: 'dms', label: 'DMS', group: 'brewhouse', smell: 'Gekochter Mais, Kohl, Tomatensauce, Meeresfrüchte',
    cause: 'Pilsner Malz, Kochen zu kurz oder mit Deckel, zu langsames Abkühlen; auch Infektion' },
  { id: 'astringent', label: 'Adstringierend', group: 'brewhouse', smell: 'Rau und pelzig, kalter Tee, Traubenkerne',
    cause: 'Treber überspült oder zu heißer Nachguss, Maische-pH zu hoch, Spelzenbruch' },
  { id: 'harsh-bitter', label: 'Kratzig-bitter', group: 'brewhouse', smell: 'Harte, lange, scharfe Bittere im Rachen',
    cause: 'Zu viel Hopfen, zu hoher Wasser-pH oder alkalisches Wasser, zu langes Hopfenkochen' },
  { id: 'phenolic', label: 'Phenolisch', group: 'brewhouse', smell: 'Pflaster, Medizin, Desinfektionsmittel, Plastik',
    cause: 'Chlor oder Chloramin im Wasser, Reste von Reiniger oder Desinfektionsmittel, wilde Hefen' },
  { id: 'metallic', label: 'Metallisch', group: 'brewhouse', smell: 'Münzen, Blut, Eisen, Tinte',
    cause: 'Eisen- oder Kupferkontakt, Oxidation, Lagerung in nicht passiviertem Edelstahl' },

  { id: 'sour-infection', label: 'Sauer / Essig', group: 'infection', smell: 'Essig, Joghurt, scharf-säuerlich',
    cause: 'Infektion mit Acetobacter oder Milchsäurebakterien, Hygiene, Luftkontakt' },
  { id: 'rancid', label: 'Ranzig / Käse', group: 'infection', smell: 'Käse, alte Socken, Erbrochenes (Butter- und Isovaleriansäure)',
    cause: 'Infektion, überalterter Hopfen, Hygiene' },
  { id: 'soapy', label: 'Seifig / ziegig', group: 'infection', smell: 'Seife, Fett, Ziege (Caprylsäure)',
    cause: 'Hefe zu lange auf dem Trub, wenig Sauerstoff, Gärung gestresst' },
  { id: 'autolysis', label: 'Hefe-Autolyse', group: 'infection', smell: 'Brühe, Soja, Gummi, Streichhölzer',
    cause: 'Bier zu lange auf der Hefe, besonders warm und in großen Gefäßen' },
  { id: 'musty', label: 'Muffig / Keller', group: 'infection', smell: 'Feuchter Keller, Schimmel, nasser Karton',
    cause: 'Infektion, schlecht gereinigte Flaschen oder Fässer, Schimmel im Malz' },

  { id: 'oxidized', label: 'Oxidiert / Pappe', group: 'oxidation', smell: 'Nasse Pappe, Papier, Altbier (trans-2-Nonenal)',
    cause: 'Sauerstoff beim Abfüllen oder Umfüllen, Alter, Wärme' },
  { id: 'sherry', label: 'Sherry / Madeira', group: 'oxidation', smell: 'Sherry, Rosinen, Wein, Leder',
    cause: 'Starke Oxidation oder lange und warme Lagerung' },
  { id: 'lightstruck', label: 'Lichtgeschädigt', group: 'oxidation', smell: 'Stinktier, Katzenurin, Kaffee-Röstung',
    cause: 'Licht (UV), besonders durch klare und grüne Flaschen' },

  { id: 'gushing', label: 'Gushing', group: 'other', smell: 'Kein Aroma: das Bier schäumt beim Öffnen über',
    cause: 'Infektion, Kristalle in der Flasche, zu viel Zucker beim Abfüllen, Kratzer im Glas' },
];

// ── The five phases ──────────────────────────────────────────────────────────────
// A choice may carry a hint (typical styles, what it means); the form shows the
// hint of the picked one under the pills.

// 1 Appearance
export const COLORS: Choice[] = [
  { id: 'pale', label: 'Hellgelb' },
  { id: 'straw', label: 'Strohgelb' },
  { id: 'gold', label: 'Goldgelb' },
  { id: 'amber', label: 'Bernstein' },
  { id: 'copper', label: 'Kupfer / Dunkelrot' },
  { id: 'brown', label: 'Kastanienbraun / Dunkelbraun' },
  { id: 'black', label: 'Tiefschwarz' },
];

// One scale from clear to opaque; "unrated" is for dark beers, where haze cannot
// be told from the colour.
export const CLARITIES: Choice[] = [
  { id: 'brilliant', label: 'Glanzfein', hint: 'Kristallklar' },
  { id: 'opalescent', label: 'Leicht opaleszent', hint: 'Minimaler Schleier' },
  { id: 'yeast-haze', label: 'Hefetrüb', hint: 'Gleichmäßig wolkig' },
  { id: 'opaque', label: 'Opak', hint: 'Völlig blickdicht, schwer trüb' },
  { id: 'unrated', label: 'Nicht beurteilbar (zu dunkel)' },
];

export const HEAD_AMOUNTS: Choice[] = [
  { id: 'none', label: 'Kein Schaum' },
  { id: 'little', label: 'Wenig' },
  { id: 'medium', label: 'Mittel' },
  { id: 'lots', label: 'Viel' },
];

export const HEAD_TEXTURES: Choice[] = [
  { id: 'fine', label: 'Feinporig', hint: 'Sahnig' },
  { id: 'medium', label: 'Mittelporig' },
  { id: 'coarse', label: 'Grobporig', hint: 'Bauschig' },
];

export const HEAD_STABILITIES: Choice[] = [
  { id: 'fleeting', label: 'Flüchtig', hint: 'Zerfällt schnell' },
  { id: 'medium', label: 'Mittel' },
  { id: 'lasting', label: 'Sehr stabil', hint: 'Langanhaltend, haftend' },
];

// 3 Attack (Antrunk)
export const CARBONATIONS: Choice[] = [
  { id: 'stale', label: 'Schal / Matt', hint: 'Sehr fehlerhaft oder extrem überlagert' },
  { id: 'soft', label: 'Schwach / Weich', hint: 'Typisch für englische Real Ales oder manche Stouts' },
  { id: 'medium', label: 'Medium / Angenehm', hint: 'Klassisch für Lagerbiere und Pils' },
  { id: 'lively', label: 'Spritzig / Lebendig / Prickelnd', hint: 'Hoch, typisch für Weizenbiere' },
  { id: 'sparkling', label: 'Moussierend / Champagnerartig', hint: 'Extrem hoch, z. B. bei belgischen Starkbieren' },
];

export const FIRST_IMPRESSIONS: Choice[] = [
  { id: 'watery', label: 'Wässrig / Neutral' },
  { id: 'sweet-malty', label: 'Süßlich-malzbetont' },
  { id: 'fresh-sour', label: 'Frisch-säuerlich' },
  { id: 'hoppy-bitter', label: 'Sofort hopfenbitter' },
];

// 4 Main sip (Haupttrunk)
export const BODIES: Choice[] = [
  { id: 'thin', label: 'Wässrig / Dünn', hint: 'Fehlerhaft, es fehlt an Substanz' },
  { id: 'slim', label: 'Schlank', hint: 'Trocken, leicht, durstlöschend. Gewollt bei Pils, Session Ales, Kölsch, Brut IPA' },
  { id: 'medium', label: 'Ausgewogen / Medium', hint: 'Standard bei Hellen, Märzen, Export, Pale Ales' },
  { id: 'full', label: 'Vollmundig / reichhaltig', hint: 'Gewollt bei Weizenbieren, Stout, Porter, Bockbier' },
  { id: 'heavy', label: 'Schwer / Ölig / Cremig / Mastig', hint: 'Durch Dextrine. Gewollt bei Doppelböcken, Barley Wines, Imperial Stouts' },
];

export const BALANCES: Choice[] = [
  { id: 'malty', label: 'Malzbetont', hint: 'Süß' },
  { id: 'balanced', label: 'Ausgewogen', hint: 'Süße und Bittere halten sich die Waage' },
  { id: 'hoppy', label: 'Hopfenbetont', hint: 'Bitter' },
  { id: 'sour', label: 'Säuerlich / Erfrischend' },
];

export const TEXTURES: Choice[] = [
  { id: 'smooth', label: 'Glatt / Samtig' },
  { id: 'creamy', label: 'Cremig / Sahnig', hint: 'Durch Beta-Glucane oder Stickstoffbläschen' },
  { id: 'juicy', label: 'Saftig', hint: 'Das Gegenteil von trocken oder spritzig/kratzig' },
  { id: 'scratchy', label: 'Kratzig / Rau', hint: 'Unrund' },
  { id: 'astringent', label: 'Adstringierend / Pelzig', hint: 'Zusammenziehend' },
  { id: 'warming', label: 'Wärmend' },
];

// 5 Finish (Nachtrunk / Abgang)
export const BITTER_INTENSITIES: Choice[] = [
  { id: 'none', label: 'Nicht wahrnehmbar / Keine Bittere' },
  { id: 'mild', label: 'Dezent / Mild' },
  { id: 'firm', label: 'Prägnant / Herb' },
  { id: 'extreme', label: 'Extrem / Beißend' },
];

export const BITTER_QUALITIES: Choice[] = [
  { id: 'soft', label: 'Weich / Harmonisch', hint: 'Sanft ausklingend' },
  { id: 'crisp', label: 'Knackig / Rein', hint: 'Vergeht sauber und hinterlässt ein trockenes Gefühl' },
  { id: 'lingering', label: 'Nachhängend / Nachbitternd / Kratzig', hint: 'Unrund, bleibt unangenehm auf der Zunge' },
];

export const FINISH_LENGTHS: Choice[] = [
  { id: 'short', label: 'Kurz', hint: 'Schnell verfliegend' },
  { id: 'medium', label: 'Mittel' },
  { id: 'long', label: 'Langanhaltend', hint: 'Aromen bleiben minutenlang im Rachenraum' },
];

export const ALCOHOLS: Choice[] = [
  { id: 'integrated', label: 'Gut eingebunden', hint: 'Nicht spürbar' },
  { id: 'warming', label: 'Angenehm wärmend' },
  { id: 'hot', label: 'Scharf / Alkoholisch / Kratzig', hint: 'Spritig' },
];

export const DRINKABILITIES: Choice[] = [
  { id: 'hard', label: 'Anstrengend / Ermüdend',
    hint: 'Das Bier ist unrund, extrem fehlerhaft oder so intensiv überladen (z. B. extreme Bittere oder künstliche Süße), dass man Mühe hat, das Glas überhaupt auszutrinken.' },
  { id: 'heavy', label: 'Schwer / Sättigend',
    hint: 'Ein sehr komplexes, wuchtiges oder klebriges Bier. Ein kleines Glas reicht völlig aus, ein zweites möchte man danach erst einmal nicht. Typisch für Eisböcke, Imperial Stouts, Barley Wines.' },
  { id: 'pleasant', label: 'Ausgewogen / Angenehm',
    hint: 'Ein schönes Genussbier. Man trinkt es gerne, nippt aber eher genüsslich daran, statt große Schlucke zu nehmen. Typisch für starke Pale Ales, Märzen.' },
  { id: 'moreish', label: 'Extrem süffig / Hohe Drinkability',
    hint: 'Das Bier erfrischt perfekt, die Aromen sind perfekt verwoben. Das Glas ist gefühlt sofort leer („Läuft einfach“). Typisch für Helles, Pils, Session IPAs.' },
];

// 7 Overall impression
export const COMPLEXITIES: Choice[] = [
  { id: 'one-dimensional', label: 'Eindimensional, langweilig' },
  { id: 'straightforward', label: 'Geradlinig', hint: 'Einfach, ehrlich. Das muss kein Nachteil sein' },
  { id: 'complex', label: 'Komplex', hint: 'Vielschichtig, entwickelt sich im Glas' },
];

export const STYLE_FITS: Choice[] = [
  { id: 'missed', label: 'Thema verfehlt', hint: 'Passt nicht zum angegebenen Stil' },
  { id: 'acceptable', label: 'Akzeptabel', hint: 'Trifft den Stil gut, leichte Abweichungen' },
  { id: 'perfect', label: 'Perfekt', hint: 'Musterbeispiel für den Stil' },
];

// How strong an off-flavour is.
export const FAULT_LEVELS: Choice[] = [
  { id: 'slight', label: 'Leicht' },
  { id: 'clear', label: 'Deutlich' },
  { id: 'strong', label: 'Stark' },
];

export const labelOf = (list: Choice[], id: string | undefined): string | undefined =>
  list.find((c) => c.id === id)?.label;
