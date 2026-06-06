Online-Datenreduktion oder Kurvenvereinfachung.

# Der Online-Linear-Interpolations-Filter
Dieser Algorithmus prüft, ob der mittlere von drei aufeinanderfolgenden Punkten weggelassen werden kann, weil er fast perfekt auf der Linie zwischen dem ersten und dem dritten Punkt liegt.
Im Speicher werden immer die letzten drei Punkte: $P_0$ (gespeichert), $P_1$ (Prüfling) und $P_2$ (aktuell eingetroffen).

* Berechnung:
1. Berechnen Sie den interpolierten Wert für $P_1$ basierend auf der Geraden zwischen $P_0$ und $P_2$.
   2. Formel für den erwarteten Wert: $Y_{interp} = Y_0 + (Y_2 - Y_0) \cdot \frac{X_1 - X_0}{X_2 - X_0}$ (wobei $X$ die Zeit und $Y$ die Temperatur ist).
   3. Prüfen Sie die Abweichung: Wenn $\vert{}Y_1 - Y_{interp}\vert{} \le \text{Fehlertoleranz}$, ist $P_1$ überflüssig.
* Aktion wenn überflüssig: $P_1$ wird einfach mit dem neuen Punkt $P_2$ überschrieben.
* Aktion wenn wichtig: $P_1$ wird fest abgespeicher. $P_1$ wird zum neuen Startpunkt $P_0$ und $P_2$ zum neuen Prüfling.

# "Bounding Box" / Sektor-Algorithmus (Höchste Effizienz)
Der Bounding Box- oder Sektor-Algorithmus (oft auch als Bounded-Slope-Algorithmus oder Dead-Band-Filter bezeichnet) ist einer der effizientesten Streaming-Algorithmen überhaupt.
Das Geniale daran: Er prüft nicht nur den Abstand zum letzten Punkt, sondern berechnet einen erlaubten Steigungsbereich (Sektor) für die Zukunft. Solange neue Datenpunkte in diesem Sektor liegen, können sie alle durch eine einzige gerade Linie ersetzt werden.
Hier ist die Funktionsweise Schritt für Schritt erklärt:
## 1. Das Grundprinzip: Der Trichter
Stellen Sie sich vor, Sie fixieren einen Startpunkt. Von diesem Punkt aus spannen Sie ein Toleranzband (ein "Rohr" oder einen "Trichter") in die Zukunft auf. Die Breite des Trichters nach oben und unten entspricht Ihrer erlaubten Fehlertoleranz (z. B. ± 0.5 °C).
Jeder neue Datenpunkt, den Sie empfangen, verengt diesen Trichter, weil er die Grenzen für die erlaubte Steigung einschränkt.
## 2. Der Ablauf im Detail
Sie starten bei einem festen Punkt $P_{Start}$ (Zeit t₀, Temperatur T₀).

   1. Der erste neue Punkt (P₁):
   * Sie berechnen die maximale Steigung ($S_{max}$) zum oberen Toleranzpunkt von P₁ (T₁ + Toleranz).
      * Sie berechnen die minimale Steigung ($S_{min}$) zum unteren Toleranzpunkt von P₁ (T₁ - Toleranz).
      * Diese beiden Steigungen bilden Ihren aktuellen Sektor (oberste und unterste Grenze). P₁ wird im RAM als "temporärer Endpunkt" gemerkt.
   2. Der nächste Punkt (P₂):
   * Sie berechnen wieder die Steigungskorridore von $P_{Start}$ zu den Toleranzgrenzen von P₂.
      * Schnittmenge bilden: Sie vergleichen die neuen Steigungen mit Ihrem bisherigen Sektor ($S_{max}$ und $S_{min}$). Der Sektor kann nur enger werden, niemals weiter. Wenn die neuen Grenzen den Korridor verkleinern, aktualisieren Sie $S_{max}$ und $S_{min}$.
      * Da P₂ innerhalb des aktuellen Sektors liegt, überschreiben Sie den temporären Endpunkt im RAM mit P₂.
   3. Der Ausbruch (P₃):
   * Ein neuer Punkt P₃ trifft ein. Seine berechnete Steigung liegt außerhalb des aktuell gültigen Sektors ($S_{max}$ / $S_{min}$). Das bedeutet: Eine gerade Linie von $P_{Start}$ zu P₃ würde die Toleranzgrenzen der dazwischen liegenden Punkte verletzen.
      * Die Aktion: Der vorherige temporäre Endpunkt (P₂) wird jetzt fest im Speicher abgelegt.
      * Der Neustart: P₂ wird nun zum neuen $P_{Start}$. Der Sektor wird von P₂ aus mit den Daten von P₃ komplett neu berechnet.
   
## Die mathematische Formel (Mikrocontroller-freundlich)
Die Steigung S zwischen zwei Punkten berechnet sich über:
$$S = \frac{T_{aktuell} - T_{Start}}{t_{aktuell} - t_{Start}}$$ 
Für jeden Punkt i berechnen Sie:

* Upper Slope: $S_{up} = \frac{(T_i + \text{Toleranz}) - T_{Start}}{t_i - t_{Start}}$
* Lower Slope: $S_{low} = \frac{(T_i - \text{Toleranz}) - T_{Start}}{t_i - t_{Start}}$

Ihr Sektor-Fenster aktualisiert sich bei jedem gültigen Punkt so:

* $S_{max} = \min(S_{max}, S_{up})$
* $S_{min} = \max(S_{min}, S_{low})$

Bedingung für den Ausbruch: Wenn irgendwann $S_{min} > S_{max}$ wird, hat sich der Sektor "gekreuzt" – der neue Punkt passt nicht mehr auf die Gerade.

# Tipps für die Implementierung auf dem Mikrocontroller

* Festkomma-Arithmetik: Float-Berechnungen sollten nach Möglichkeit vermieden werden, falls der Mikrocontroller (z. B. kleinere 8-Bit AVRs) keine Hardware-FPU hat. Stattdessen sollten die Messwerte mit 10 oder 100 multipliziert und mit int gerechnet werden.
* Zeitstempel nicht vergessen: Da die Datenpunkte nun unregelmäßige Zeitabstände haben, müssen zu jedem Temperaturwert auch zwingend der Zeitstempel (z. B. Unix-Zeit oder Millisekunden seit Start) abgespeichert werden.
* Maximaler Abstand als Sicherheitsregel: Wenn z. B. nach 10 Minuten kein Punkt gespeichert wurde (weil die Temperatur absolut stabil ist), wird trotzdem eine Punkt gespeichert. So sieht man im Diagramm später, dass das System noch aktiv war.


struct DataPoint {
    uint32_t timestamp; // z.B. Millisekunden oder Unix-Zeit
    float temperature;
};


class LinearInterpolationFilter {
private:
    DataPoint p0; // Letzter fix gespeicherter Punkt
    DataPoint p1; // Der Prüfling im RAM
    float tolerance;
    uint32_t timeout_ms;
    bool has_p0 = false;
    bool has_p1 = false;

public:
    // Übergabe der Toleranz und des Timeouts in Millisekunden
    LinearInterpolationFilter(float tolerance_deg, uint32_t timeout) 
        : tolerance(tolerance_deg), timeout_ms(timeout) {}

    bool processNewPoint(DataPoint p2, DataPoint& savedPoint) {
        if (!has_p0) {
            p0 = p2;
            has_p0 = true;
            savedPoint = p0;
            return true; // Erster Punkt wird sofort gespeichert
        }
        if (!has_p1) {
            p1 = p2;
            return false;
        }

        // NEU: Prüfe zuerst, ob der aktuelle Punkt p2 den Timeout ab p0 überschreitet
        if ((p2.timestamp - p0.timestamp) >= timeout_ms) {
            // Timeout erreicht! Wir speichern den aktuellen Prüfling p1 fest ab,
            // um die Kette nicht zu unterbrechen, und machen p2 zum neuen Prüfling.
            savedPoint = p1;
            p0 = p1;
            p1 = p2;
            return true;
        }

        // Lineare Interpolation berechnen
        float time_diff_total = (float)(p2.timestamp - p0.timestamp);
        float time_diff_p1 = (float)(p1.timestamp - p0.timestamp);
        
        if (time_diff_total <= 0.0f) return false;

        float t_interpolated = p0.temperature + (p2.temperature - p0.temperature) * (time_diff_p1 / time_diff_total);

        // Toleranzprüfung
        if (fabs(p1.temperature - t_interpolated) > tolerance) {
            savedPoint = p1;
            p0 = p1;
            p1 = p2;
            return true;
        } else {
            // Liegt im Limit: p1 mit dem neuesten Wert p2 überschreiben
            p1 = p2;
            return false;
        }
    }
};


class BoundingBoxFilter {
private:
    DataPoint p_start; // Startpunkt der aktuellen Geraden
    DataPoint p_last;  // Der jeweils letzte gültige Punkt (Ihr Aktivitäts-Marker)
    float tolerance;
    uint32_t timeout_ms;
    float max_slope;
    float min_slope;
    bool initialized = false;

public:
    // Übergabe der Toleranz und des Timeouts in Millisekunden
    BoundingBoxFilter(float tolerance_deg, uint32_t timeout) 
        : tolerance(tolerance_deg), timeout_ms(timeout) {}

    bool processNewPoint(DataPoint p_new, DataPoint& savedPoint) {
        if (!initialized) {
            p_start = p_new;
            p_last = p_new;
            initialized = true;
            max_slope = 3e38f;
            min_slope = -3e38f;
            savedPoint = p_start;
            return true;
        }

        // NEU: Prüfe, ob die Zeit seit dem letzten FIXEN Startpunkt den Timeout überschreitet
        if ((p_new.timestamp - p_start.timestamp) >= timeout_ms) {
            // Timeout erreicht! Speichere den letzten bekannten Punkt (p_last)
            savedPoint = p_last;

            // Neustart ab p_last, p_new initialisiert den neuen Trichter
            p_start = p_last;
            p_last = p_new;

            float dt_new = (float)(p_new.timestamp - p_start.timestamp);
            if (dt_new > 0.0f) {
                max_slope = ((p_new.temperature + tolerance) - p_start.temperature) / dt_new;
                min_slope = ((p_new.temperature - tolerance) - p_start.temperature) / dt_new;
            } else {
                max_slope = 3e38f;
                min_slope = -3e38f;
            }
            return true;
        }

        float dt = (float)(p_new.timestamp - p_start.timestamp);
        if (dt <= 0.0f) return false;

        // Steigungskorridore berechnen
        float slope_up  = ((p_new.temperature + tolerance) - p_start.temperature) / dt;
        float slope_low = ((p_new.temperature - tolerance) - p_start.temperature) / dt;

        float new_max_slope = (slope_up < max_slope) ? slope_up : max_slope;
        float new_min_slope = (slope_low > min_slope) ? slope_low : min_slope;

        // Prüfe auf Ausbruch
        if (new_min_slope > new_max_slope) {
            savedPoint = p_last;
            p_start = p_last;
            p_last = p_new;
            
            float dt_new = (float)(p_new.timestamp - p_start.timestamp);
            max_slope = ((p_new.temperature + tolerance) - p_start.temperature) / dt_new;
            min_slope = ((p_new.temperature - tolerance) - p_start.temperature) / dt_new;
            
            return true;
        } else {
            max_slope = new_max_slope;
            min_slope = new_min_slope;
            p_last = p_new;
            return false;
        }
    }

    DataPoint getLastPoint() const { return p_last; }
};



// Beispiel: 0.5 Grad Toleranz, 15 Minuten Timeout (15 * 60 * 1000 = 900000 ms)
BoundingBoxFilter filter(0.5f, 900000); 

void loop() {
    // 1. Simulierter Sensoraufruf alle paar Sekunden
    uint32_t jetzt = millis();
    float aktuelle_temp = readTemperatureSensor(); 
    
    DataPoint neuer_messpunkt = { jetzt, aktuelle_temp };
    DataPoint punkt_zum_speichern;

    // 2. Filter füttern
    if (filter.processNewPoint(neuer_messpunkt, punkt_zum_speichern)) {
        // Dieser Block wird nur ausgeführt, wenn der Filter "true" meldet.
        // Jetzt schreiben wir den Punkt in den permanenten Speicher!
        writeToPermanentStorage(punkt_zum_speichern);
    }
    
    delay(5000); // 5 Sekunden warten
}




Selbst wenn die Mikrocontroller-Kompression die Daten bereits um 90 % reduziert hat, können sich über Monate hinweg tausende Datenpunkte ansammeln. Wenn ein Frontend versucht, 50.000 Punkte in einem Diagramm anzuzeigen, das auf dem Bildschirm nur 1.000 Pixel breit ist, führt das zu massiven Problemen: Der Browser wird extrem langsam, und das Diagramm "matscht" visuell komplett zu.
Für das Frontend oder die API nutzt man jedoch andere Algorithmen als auf dem Mikrocontroller, da hier die Daten bereits vollständig vorliegen (Batch-Processing).
Hier sind die drei gängigsten Strategien für die API- und das Frontend-Design:
## 1. Der Klassiker fürs Frontend: Der Douglas-Peucker-Algorithmus
Das ist der Industriestandard für die nachträgliche Kurvenvereinfachung. Er reduziert die Anzahl der Punkte drastisch, behält aber die visuelle Charakteristik (Spitzen und Täler) perfekt bei.

* Wie es funktioniert: Er zieht eine Linie vom allerersten zum allerletzten Punkt der Kurve und sucht den Punkt, der am weitesten von dieser Linie abweicht. Ist die Abweichung größer als eine Toleranz ($\epsilon$), wird die Kurve dort geteilt und das Ganze rekursiv wiederholt.
* Vorteil: Nahezu jedes moderne Frontend-Diagramm-Framework (z. B. Chart.js, ApexCharts, ECharts oder Leaflet) hat diesen Algorithmus entweder bereits fest eingebaut oder es gibt fertige, winzige JavaScript-Bibliotheken (wie simplify-js) dafür.

## 2. Für sehr große Zeiträume: Largest-Triangle-Three-Buckets (LTTB)
Wenn Sie von einer Jahresansicht in eine Tagesansicht zoomen, ist Douglas-Peucker manchmal visuell unschön, weil er statistische Extrema (z. B. eine kurze, extreme Temperaturspitze) übersehen kann. Hier glänzt der LTTB-Algorithmus.

* Wie es funktioniert: Er teilt die Daten in gleich große Blöcke (Buckets) auf – genau so viele, wie Sie Pixel oder Ziel-Datenpunkte haben wollen (z. B. 500 Buckets für 500 Pixel Breite). Dann wählt er aus jedem Block den Punkt aus, der mit den Punkten der Nachbarblöcke das größte Dreieck aufspannt.
* Vorteil: Er garantiert, dass optische Spitzen und Täler im Frontend exakt sichtbar bleiben, selbst bei einer Reduktion von 100.000 auf 500 Punkte.

## Wo sollte die Reduktion stattfinden?
Das hängt davon ab, wie leistungsfähig Ihr Backend ist, das die API bereitstellt:

* Strategie A (Datenbank / API-Ebene – Empfohlen): Das Frontend sendet beim Zoomen oder Laden den gewünschten Zeitraum und die Breite des Charts (z. B. ?von=1717590000&bis=1717676400&points=1000) an die API. Das Backend holt die Daten, jagt sie durch den LTTB- oder Douglas-Peucker-Algorithmus auf die gewünschte Punktanzahl herunter und liefert eine winzige, schnelle JSON-Antwort. 
* Strategie B (Frontend-Ebene): Die API liefert immer die Rohdaten des gewählten Zeitraums, und das Frontend vereinfacht die Daten via JavaScript (z. B. mit simplify-js), bevor es sie an das Chart-Framework übergibt. Das funktioniert super, solange der geladene Zeitraum nicht standardmäßig Millionen von Punkten enthält.


