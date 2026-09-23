# Arduino_GFX 1.3.7 (LilyGo-Fork, gekürzt)

Panel-Treiber für das runde 466×466-AMOLED (CO5300 über QSPI) des LilyGo
T-Display-S3-AMOLED-1.75. Wird nur vom Env `lilygo_t_display_s3_amoled` per
`symlink://vendor/Arduino_GFX-1.3.7` eingebunden.

**Herkunft:** `libraries/Arduino_GFX-1.3.7/` aus
<https://github.com/Xinyuan-LilyGO/T-Display-S3-AMOLED-1.43-1.75>, Commit
`87aabe888eea6a7c0f95ce1991ca75fa98c2a172`. Das Repo steht unter MIT (`LICENSE` hier
unverändert übernommen). Upstream der Library ist
<https://github.com/moononournation/Arduino_GFX>. **Achtung:**
`src/display/Arduino_CO5300.cpp` (von LilyGo ergänzt) trägt im Dateikopf
„@License: GPL 3.0“. Das widerspricht der Repo-Lizenz und ist ungeklärt.

**Warum vendored und nicht aus der Registry:** Keine Registry-Version baut für
ESP32-S3 auf Arduino Core 2 **und** kennt den CO5300 — unter 1.6.1 fehlt der
Controller, 1.6.1 scheitert am Guard in `Arduino_ESP32RGBPanel.h`, ab 1.6.2 wird
`esp32-hal-periman.h` (Core 3) verlangt. PlatformIO kompiliert jede `.cpp` einer
Library, auch ungenutzte Backends. Ein selbstgeschriebener Treiber brachte im
Spike 2026-09-22 trotz gleicher Init-Sequenz kein Bild (siehe `SESSION.md`).

**Gekürzt:** Nur die Dateien, die `Arduino_ESP32QSPI` + `Arduino_CO5300`
brauchen, sind übernommen, und zwar **inhaltlich unverändert**. Die 17 MB Fonts
sowie alle anderen Busse und Controller fehlen. Die U8g2-Fonts hängen an
`__has_include(<U8g2lib.h>)` und bleiben dadurch aus. `src/pin_config.h`
ersetzt LilyGos `Mylibrary/pin_config.h`: `Arduino_TFT.cpp` braucht daraus nur
das Define `H0175Y003AM`.
