// Catalog of the brewing-process calculators the Rechner page offers — plain
// data, shared by the index page (category cards) and the detail page
// (resolves the :calc route param to a title/description). Pattern mirrors
// itemTypes.ts. Component wiring lives in RechnerDetail.tsx, not here.
import {
  ArrowLeftRight, Cylinder, Droplets, Waves, Thermometer, Percent, Gauge, FlaskConical, CookingPot,
  TestTube2, Scale, Beaker, Wine, Sigma,
  type LucideIcon,
} from 'lucide-preact';

export type CalcId =
  | 'einheiten-umrechner'
  | 'volumen'
  | 'verduennen-einkochen'
  | 'mischkreuz'
  | 'einmaischtemperatur'
  | 'maischeeffizienz'
  | 'sudhausausbeute'
  | 'brewhouse-efficiency'
  | 'karbonisierung'
  | 'spindel-korrektur'
  | 'refraktometer-korrektur'
  | 'ueberrange-messung'
  | 'abv'
  | 'endvergaerungsgrad';

export interface CalcCategory {
  id: string;
  title: string;
}

export const CATEGORIES: CalcCategory[] = [
  { id: 'einheiten', title: 'Einheiten' },
  { id: 'volumen', title: 'Volumen' },
  { id: 'mischen', title: 'Mischen' },
  { id: 'effizienz', title: 'Effizienz' },
  { id: 'karbonisierung', title: 'Karbonisierung' },
  { id: 'messen', title: 'Messen' },
];

export interface CalcEntry {
  id: CalcId;
  category: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

export const CALCULATORS: CalcEntry[] = [
  { id: 'einheiten-umrechner', category: 'einheiten', icon: ArrowLeftRight,
    title: 'Einheiten-Umrechner', desc: 'Plato, SG und Brix ineinander umrechnen' },

  { id: 'volumen', category: 'volumen', icon: Cylinder,
    title: 'Volumenrechner', desc: 'Volumen aus Füllhöhe für Zylinder oder Kegelstumpf' },

  { id: 'verduennen-einkochen', category: 'mischen', icon: Droplets,
    title: 'Verdünnen / Einkochen', desc: 'Ziel-Stammwürze durch Verdünnen oder Einkochen treffen' },
  { id: 'mischkreuz', category: 'mischen', icon: Waves,
    title: 'Mischkreuz', desc: 'Zwei Flüssigkeiten unterschiedlicher Stammwürze oder Temperatur mischen' },
  { id: 'einmaischtemperatur', category: 'mischen', icon: Thermometer,
    title: 'Einmaischtemperatur', desc: 'Hauptguss-Temperatur für die Ziel-Maischtemperatur' },

  { id: 'maischeeffizienz', category: 'effizienz', icon: Percent,
    title: 'Maischeeffizienz', desc: 'Ausbeute nach dem Läutern aus Ist-Werten' },
  { id: 'sudhausausbeute', category: 'effizienz', icon: Gauge,
    title: 'Sudhausausbeute', desc: 'Ausbeute der Ausschlagwürze aus Ist-Werten' },
  { id: 'brewhouse-efficiency', category: 'effizienz', icon: FlaskConical,
    title: 'Brewhouse-Efficiency', desc: 'Ausbeute der Anstellwürze aus Ist-Werten' },

  { id: 'karbonisierung', category: 'karbonisierung', icon: CookingPot,
    title: 'Karbonisierung', desc: 'Zucker- oder Speisemenge zum Abfüllen, Grünschlauch-Empfehlung' },

  { id: 'spindel-korrektur', category: 'messen', icon: TestTube2,
    title: 'Spindel-Korrektur', desc: 'Hydrometer-Messwert auf Kalibriertemperatur korrigieren' },
  { id: 'refraktometer-korrektur', category: 'messen', icon: Beaker,
    title: 'Refraktometer-Korrektur', desc: 'Brix-Messwert während laufender Gärung korrigieren' },
  { id: 'ueberrange-messung', category: 'messen', icon: Scale,
    title: 'Überrange-Messung', desc: '"Würze durch die Decke" — verdünnte Probe zurückrechnen' },
  { id: 'abv', category: 'messen', icon: Wine,
    title: 'Alkohol (ABV)', desc: 'Aus Stammwürze/Restextrakt, auch bei unbekannter Stammwürze' },
  { id: 'endvergaerungsgrad', category: 'messen', icon: Sigma,
    title: 'Endvergärungsgrad', desc: 'Scheinbarer und realer Vergärungsgrad aus OG/FG' },
];
