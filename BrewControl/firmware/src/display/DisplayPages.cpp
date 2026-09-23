#include "DisplayPages.h"

#ifdef BREWCTL_HAS_DISPLAY

#include <lvgl.h>

namespace BrewControl {

// Bring-up screen: colour order (R/G/B bars), the round edge (a ring that must
// touch the rim evenly all around), and the custom fonts incl. umlauts and °.
void DisplayPages::begin() {
  lv_obj_t* scr = lv_scr_act();
  lv_obj_set_style_bg_color(scr, lv_color_black(), 0);

  lv_obj_t* ring = lv_obj_create(scr);
  lv_obj_set_size(ring, 466, 466);
  lv_obj_center(ring);
  lv_obj_set_style_radius(ring, LV_RADIUS_CIRCLE, 0);
  lv_obj_set_style_bg_opa(ring, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(ring, 4, 0);
  lv_obj_set_style_border_color(ring, lv_color_white(), 0);

  const uint32_t colors[] = {0xFF0000, 0x00FF00, 0x0000FF};
  for (int i = 0; i < 3; ++i) {
    lv_obj_t* bar = lv_obj_create(scr);
    lv_obj_set_size(bar, 60, 60);
    lv_obj_set_style_radius(bar, 0, 0);
    lv_obj_set_style_border_width(bar, 0, 0);
    lv_obj_set_style_bg_color(bar, lv_color_hex(colors[i]), 0);
    lv_obj_align(bar, LV_ALIGN_TOP_MID, (i - 1) * 70, 70);
  }

  lv_obj_t* big = lv_label_create(scr);
  lv_obj_set_style_text_font(big, &brew_font_64, 0);
  lv_obj_set_style_text_color(big, lv_color_white(), 0);
  lv_label_set_text(big, "67,5");
  lv_obj_align(big, LV_ALIGN_CENTER, 0, -10);

  lv_obj_t* mid = lv_label_create(scr);
  lv_obj_set_style_text_font(mid, &brew_font_28, 0);
  lv_obj_set_style_text_color(mid, lv_color_hex(0xFFCC66), 0);
  lv_label_set_text(mid, "Brühwürze °C");
  lv_obj_align(mid, LV_ALIGN_CENTER, 0, 50);

  lv_obj_t* small = lv_label_create(scr);
  lv_obj_set_style_text_color(small, lv_color_hex(0xAAAAAA), 0);
  lv_label_set_text(small, "Kühlen · Füllhöhe · Maß");
  lv_obj_align(small, LV_ALIGN_CENTER, 0, 95);
}

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
