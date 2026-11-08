# Display-Fonts

Die eingebauten Montserrat-Fonts von LVGL decken nur ASCII plus `°` ab. Deutsche
Labels („Kühlen“, „Füllhöhe“) hätten damit Lücken. Diese Fonts sind deshalb
eigens erzeugt:

| Datei | Größe | Inhalt |
|---|---|---|
| `brew_font_20.c` | 20 px | Latin-1 (0x20–0x7E, 0xA0–0xFF) — Default-Font |
| `brew_font_28.c` | 28 px | Latin-1 + sechs Symbole (Power, Warnung, Plus, Minus, Chevron links, WLAN) |
| `brew_font_56.c` | 56 px | nur `NOT-AUS` + Warnsymbol — Not-Aus-Bildschirm und „AN“/„AUS“ der breiten Ansicht |
| `brew_font_64.c` | 64 px | nur `0123456789 +-.,:%` — große Messwerte |
| `brew_font_96.c` | 96 px | wie 64 px, für die breite Ansicht (`DisplayWide.cpp`) |

Quelle: `Montserrat-Medium.ttf` und `FontAwesome5-Solid+Brands+Regular.woff` aus dem
LVGL-8.4-Paket (`.pio/libdeps/lilygo_t_display_s3_amoled/lvgl/scripts/built_in_font/`).
Beide stehen unter SIL OFL 1.1.

**Neu erzeugen** (Git Bash, aus `BrewControl/firmware/`, nach einem Build des Envs):

```bash
FD=.pio/libdeps/lilygo_t_display_s3_amoled/lvgl/scripts/built_in_font
C="npx -y lv_font_conv@1.5.2 --no-compress --no-prefilter --bpp 4 --format lvgl --lv-include lvgl.h"
$C --size 20 --font $FD/Montserrat-Medium.ttf -r 0x20-0x7E,0xA0-0xFF -o src/display/fonts/brew_font_20.c
$C --size 28 --font $FD/Montserrat-Medium.ttf -r 0x20-0x7E,0xA0-0xFF \
   --font "$FD/FontAwesome5-Solid+Brands+Regular.woff" -r 0xF011,0xF071,0xF067,0xF068,0xF053,0xF1EB \
   -o src/display/fonts/brew_font_28.c
$C --size 56 --font $FD/Montserrat-Medium.ttf --symbols "NOT-AUS" \
   --font "$FD/FontAwesome5-Solid+Brands+Regular.woff" -r 0xF071 -o src/display/fonts/brew_font_56.c
$C --size 64 --font $FD/Montserrat-Medium.ttf --symbols "0123456789 +-.,:%" -o src/display/fonts/brew_font_64.c
$C --size 96 --font $FD/Montserrat-Medium.ttf --symbols "0123456789 +-.,:%" -o src/display/fonts/brew_font_96.c
```

Danach jede Datei in `#ifdef BREWCTL_HAS_DISPLAY` … `#endif` einschließen. Sie liegen
unter `src/` und werden deshalb in jedem Env kompiliert, aber nur das Display-Env hat
`lvgl.h`.
