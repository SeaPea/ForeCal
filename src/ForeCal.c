#include "pebble.h"

static Window *window;

static Layer *current_layer = NULL;
static TextLayer *clock_layer = NULL;
static TextLayer *pm_layer = NULL;
static TextLayer *date_layer = NULL;
static AppTimer *bt_timer = NULL;
static GBitmap *bt_icon = NULL;
static BitmapLayer *bt_layer = NULL;
static GBitmap *batt_icon = NULL;
static BitmapLayer *batt_layer = NULL;

static TextLayer *curr_temp_layer = NULL;
static TextLayer *sun_rise_set_layer = NULL;

static Layer *forecast_layer = NULL;
static TextLayer *forecast_day_layer = NULL;
static TextLayer *status_layer = NULL;
static AppTimer *status_timer = NULL;
static TextLayer *condition_layer = NULL;
static TextLayer *high_temp_layer = NULL;
static TextLayer *high_label_layer = NULL;
static TextLayer *low_temp_layer = NULL;
static TextLayer *low_label_layer = NULL;

//static BitmapLayer *icon_layer;
//static GBitmap *icon_bitmap = NULL;

static Layer *cal_layer = NULL;
static InverterLayer *curr_date_layer = NULL;

static InverterLayer *nightmode_layer = NULL;

static const uint32_t const bt_warn_pattern[] = { 1000, 500, 1000 };
static int startday = 0;
static char *weekdays[7] = {"Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"};

static AppSync sync;
static uint8_t sync_buffer[256];

static char current_time[] = "00:00";
static char current_date[] = "Sun Jan 01";

static char status[50] = "";

enum WeatherKey {
  WEATHER_STATUS_KEY = 0x0,
  WEATHER_CURR_TEMP_KEY = 0x1,
  WEATHER_SUN_RISE_SET_KEY = 0x2,
  WEATHER_FORECAST_DAY_KEY = 0x3,
  WEATHER_HIGH_TEMP_KEY = 0x4,
  WEATHER_LOW_TEMP_KEY = 0x5,
  WEATHER_ICON_KEY = 0x6,
  WEATHER_CONDITION_KEY = 0x7,
  WEATHER_NIGHTMODE_KEY = 0x8,
  WEATHER_CITY_KEY = 0x9
};

/*static const uint32_t WEATHER_ICONS[] = {
  RESOURCE_ID_IMAGE_SUN, //0
  RESOURCE_ID_IMAGE_CLOUD, //1
  RESOURCE_ID_IMAGE_RAIN, //2
  RESOURCE_ID_IMAGE_SNOW //3
};*/

static void handle_status_timer(void *data) {
  text_layer_set_text(status_layer, status);
  status_timer = NULL;
}

static void sync_error_callback(DictionaryResult dict_error, AppMessageResult app_message_error, void *context) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "App Message Sync Error: %d", app_message_error);
  text_layer_set_text(status_layer, "Comm error");
}

static void sync_tuple_changed_callback(const uint32_t key, const Tuple* new_tuple, const Tuple* old_tuple, void* context) {
  switch (key) {
    /*case WEATHER_ICON_KEY:
      if (icon_bitmap) {
        gbitmap_destroy(icon_bitmap);
      }
      icon_bitmap = gbitmap_create_with_resource(WEATHER_ICONS[new_tuple->value->uint8]);
      bitmap_layer_set_bitmap(icon_layer, icon_bitmap);
      break;
*/
    case WEATHER_STATUS_KEY:
      //text_layer_set_text(status_layer, new_tuple->value->cstring);
      snprintf(status, sizeof(status), "%s", new_tuple->value->cstring);
      break;
    case WEATHER_CITY_KEY:
      text_layer_set_text(status_layer, new_tuple->value->cstring);
      if (status_timer) {
        APP_LOG(APP_LOG_LEVEL_DEBUG, "Status Timer Rescheduled");
        app_timer_reschedule(status_timer, 5000);
      }
      else {
        APP_LOG(APP_LOG_LEVEL_DEBUG, "Status Timer Scheduled");
        status_timer = app_timer_register(5000, handle_status_timer, NULL);
      }
      break;
    case WEATHER_CURR_TEMP_KEY:
      text_layer_set_text(curr_temp_layer, new_tuple->value->cstring);
      break;
    case WEATHER_SUN_RISE_SET_KEY:
      text_layer_set_text(sun_rise_set_layer, new_tuple->value->cstring);
      break;
    case WEATHER_FORECAST_DAY_KEY:
      text_layer_set_text(forecast_day_layer, new_tuple->value->cstring);
      break;
    case WEATHER_HIGH_TEMP_KEY:
      text_layer_set_text(high_temp_layer, new_tuple->value->cstring);
      layer_set_hidden(text_layer_get_layer(high_label_layer), strlen(new_tuple->value->cstring) == 0);
      break;
    case WEATHER_LOW_TEMP_KEY:
      text_layer_set_text(low_temp_layer, new_tuple->value->cstring);
      layer_set_hidden(text_layer_get_layer(low_label_layer), strlen(new_tuple->value->cstring) == 0);
      break;
    case WEATHER_CONDITION_KEY:
      text_layer_set_text(condition_layer, new_tuple->value->cstring);
      break;
    case WEATHER_NIGHTMODE_KEY:
      layer_set_hidden(inverter_layer_get_layer(nightmode_layer), (new_tuple->value->uint8 == 0));
      break;  
  }
}

static void update_weather(void) {
  text_layer_set_text(status_layer, "Fetching...");
  
  Tuplet value = TupletInteger(1, 1);

  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);

  if (iter == NULL) {
    return;
  }

  dict_write_tuplet(iter, &value);
  dict_write_end(iter);

  app_message_outbox_send();
}

static void handle_tick(struct tm *tick_time, TimeUnits units_changed) {
  if ((units_changed & MINUTE_UNIT) != 0) {
    clock_copy_time_string(current_time, sizeof(current_time));
    text_layer_set_text(clock_layer, current_time);
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Current time: %s", current_time);
    if (tick_time->tm_min % 30 == 0) {
      update_weather(); // Update the weather every 30 minutes
    }
  }
  if ((units_changed & HOUR_UNIT) != 0) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Hour changed");
    if (clock_is_24h_style()) {
      text_layer_set_text(pm_layer, "");
    }
    else {
      if (tick_time->tm_hour >= 12) {
        text_layer_set_text(pm_layer, "PM");
      }
      else {
        text_layer_set_text(pm_layer, "AM");
      }
    }
  }
  if ((units_changed & DAY_UNIT) != 0) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Day changed");
    strftime(current_date, sizeof(current_date), "%a %b %d", tick_time);
    text_layer_set_text(date_layer, current_date);
    // Trigger redraw of calendar
    layer_mark_dirty(cal_layer);
  }
}

static void update_bt_icon(bool connected) {
  if (connected) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Connected");
    bitmap_layer_set_bitmap(bt_layer, bt_icon);
  }
  else {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT DISCONNECTED");
    bitmap_layer_set_bitmap(bt_layer, NULL);
    
    VibePattern pat = {
      .durations = bt_warn_pattern,
      .num_segments = ARRAY_LENGTH(bt_warn_pattern),
    };
    vibes_enqueue_custom_pattern(pat);
  }
}

static void handle_bt_timeout(void *data) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Update - 15sec");
  bt_timer = NULL;
  update_bt_icon(bluetooth_connection_service_peek());
}

static void handle_bt_update(bool connected) {
  if (connected) {
    // If connected, immediately update BT icon
    if (bt_timer)
      app_timer_cancel(bt_timer);
    
    update_bt_icon(bluetooth_connection_service_peek());
  }
  else {
    // If disconnected, wait 15 seconds to update BT icon in case of reconnect
    if (bt_timer) {
      APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Timer Rescheduled");
      app_timer_reschedule(bt_timer, 15000);
    }
    else {
      APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Timer Scheduled");
      bt_timer = app_timer_register(15000, handle_bt_timeout, NULL);
    }
  }
}

static void handle_batt_update(BatteryChargeState batt_status) {
  if (batt_icon) {
    gbitmap_destroy(batt_icon);
  }
  
  if (batt_status.is_charging) {
    batt_icon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_BATT_CHARGE);
  }
  else {
    if (batt_status.charge_percent > 75) {
      batt_icon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_BATT_100);
    } else if (batt_status.charge_percent > 50) {
      batt_icon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_BATT_75);
    } else if (batt_status.charge_percent > 25) {
      batt_icon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_BATT_50);
    } else {
      batt_icon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_BATT_25);
    }
  }
  
  bitmap_layer_set_bitmap(batt_layer, batt_icon);
}

static void current_layer_draw(Layer *layer, GContext *ctx) {
  graphics_context_set_stroke_color(ctx, GColorWhite);
  graphics_draw_line(ctx, GPoint(0, 57), GPoint(144, 57));
}

// Draw dates for a single week in the calendar
static void cal_week_draw_dates(GContext *ctx, int start_date, int curr_mon_len, int prev_mon_len, GColor font_color, int ypos) {
  
  int curr_date;
  char curr_date_str[3];
  
  graphics_context_set_text_color(ctx, font_color);
  
  for (int d = 0; d < 7; d++) {
    // Calculate the current date being drawn
    if ((start_date + d) < 1)
      curr_date = start_date + d + prev_mon_len;
    else if ((start_date + d) > curr_mon_len)
      curr_date = start_date + d - curr_mon_len;
    else
      curr_date = start_date + d;
    
    // Draw the date text in the correct calendar cell
    snprintf(curr_date_str, 3, "%d", curr_date);
    graphics_draw_text(ctx, curr_date_str, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD), 
                       GRect((d * 20) + d, ypos, 19, 14), GTextOverflowModeFill, GTextAlignmentCenter, NULL);
  }
}

static void cal_layer_draw(Layer *layer, GContext *ctx) {
  // Paint calendar background
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_rect(ctx, GRect(0, 0, 144, 46), 0, GCornerNone);
  
  // Paint inverted row background
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, GRect(0, 11, 144, 11), 0, GCornerNone);
  graphics_fill_rect(ctx, GRect(0, 35, 144, 11), 0, GCornerNone);
  
  // Draw day separators
  graphics_context_set_stroke_color(ctx, GColorWhite);
  for (int c = 1; c < 7; c++) {
    graphics_draw_line(ctx, GPoint((c*20) + c - 1, 11), GPoint((c*20) + c - 1, 46));
  }
  
  // Get current time
  struct tm *t;
  time_t temp;
  temp = time(NULL);
  t = localtime(&temp);
  
  graphics_context_set_text_color(ctx, GColorBlack);
  GFont curr_font;
  
  // Draw week day names
  for (int d = 0; d < 7; d++) {
    if (t->tm_wday == ((d + startday) % 7))
      curr_font = fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD);
    else
      curr_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
    graphics_draw_text(ctx, weekdays[(d + startday) % 7], curr_font, GRect((d * 20) + d, -4, 19, 14), 
                       GTextOverflowModeFill, GTextAlignmentCenter, NULL);
  }
  
  // Calculate leap year and month lengths
  int leap_year = (((1900 + t->tm_year) % 100) == 0 ? 0 : (((1900 + t->tm_year) % 4) == 0) ? 1 : 0);
  int prev_mon = (t->tm_mon) == 0 ? 12 : t->tm_mon;
  int curr_mon = t->tm_mon + 1;
  int prev_mon_len = 31 - ((prev_mon == 2) ? (3 - leap_year) : ((prev_mon - 1) % 7 % 2));
  int curr_mon_len = 31 - ((curr_mon == 2) ? (3 - leap_year) : ((curr_mon - 1) % 7 % 2));
  
  // Draw previous week dates
  cal_week_draw_dates(ctx, t->tm_mday - t->tm_wday - 7 + startday, curr_mon_len, prev_mon_len, GColorWhite, 7);
  // Draw current week dates
  cal_week_draw_dates(ctx, t->tm_mday - t->tm_wday + startday, curr_mon_len, prev_mon_len, GColorBlack, 19);
  // Draw next week dates
  cal_week_draw_dates(ctx, t->tm_mday - t->tm_wday + 7 + startday, curr_mon_len, prev_mon_len, GColorWhite, 31);
  
  // Invert current date colors to highlight it
  int curr_day = (t->tm_wday + 7 - startday) % 7;
  layer_set_frame(inverter_layer_get_layer(curr_date_layer), GRect((curr_day  * 20) + curr_day, 23, 19, 11));
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  
  // Get current time
  struct tm *t;
  time_t temp;
  temp = time(NULL);
  t = localtime(&temp);
  
  current_layer = layer_create(GRect(0, 0, 144, 58));
  
  clock_layer = text_layer_create(GRect(-1, -14, 126, 50));
  text_layer_set_text_color(clock_layer, GColorWhite);
  text_layer_set_background_color(clock_layer, GColorClear);
  text_layer_set_font(clock_layer, fonts_get_system_font(FONT_KEY_ROBOTO_BOLD_SUBSET_49));
  text_layer_set_text_alignment(clock_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(clock_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(clock_layer));
  
  pm_layer = text_layer_create(GRect(123, 23, 20, 15));
  text_layer_set_text_color(pm_layer, GColorWhite);
  text_layer_set_background_color(pm_layer, GColorClear);
  text_layer_set_font(pm_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(pm_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(pm_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(pm_layer));
  
  date_layer = text_layer_create(GRect(60, 30, 84, 26));
  text_layer_set_text_color(date_layer, GColorWhite);
  text_layer_set_background_color(date_layer, GColorClear);
  text_layer_set_font(date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(date_layer, GTextAlignmentRight);
  text_layer_set_overflow_mode(date_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(date_layer));
  
  bt_layer = bitmap_layer_create(GRect(129, 1, 9, 16));
  layer_add_child(current_layer, bitmap_layer_get_layer(bt_layer));
  update_bt_icon(bluetooth_connection_service_peek());
  
  batt_layer = bitmap_layer_create(GRect(126, 18, 16, 8));
  layer_add_child(current_layer, bitmap_layer_get_layer(batt_layer));
  BatteryChargeState batt_state = battery_state_service_peek();
  handle_batt_update(batt_state);
  
  layer_add_child(window_layer, current_layer);
  
  layer_set_update_proc(current_layer, current_layer_draw);
  
  /*icon_layer = bitmap_layer_create(GRect(32, 10, 40, 40));
  layer_add_child(window_layer, bitmap_layer_get_layer(icon_layer));*/
  
  curr_temp_layer = text_layer_create(GRect(0, 30, 40, 26));
  text_layer_set_text_color(curr_temp_layer, GColorWhite);
  text_layer_set_background_color(curr_temp_layer, GColorClear);
  text_layer_set_font(curr_temp_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(curr_temp_layer, GTextAlignmentLeft);
  text_layer_set_overflow_mode(curr_temp_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(curr_temp_layer));
  
  sun_rise_set_layer = text_layer_create(GRect(38, 40, 34, 14));
  text_layer_set_text_color(sun_rise_set_layer, GColorWhite);
  text_layer_set_background_color(sun_rise_set_layer, GColorClear);
  text_layer_set_font(sun_rise_set_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(sun_rise_set_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(sun_rise_set_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(sun_rise_set_layer));
  
  forecast_layer = layer_create(GRect(0, 58, 144, 63));
  
  forecast_day_layer = text_layer_create(GRect(0, -4, 64, 18));
  text_layer_set_text_color(forecast_day_layer, GColorWhite);
  text_layer_set_background_color(forecast_day_layer, GColorClear);
  text_layer_set_font(forecast_day_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_text_alignment(forecast_day_layer, GTextAlignmentLeft);
  text_layer_set_overflow_mode(forecast_day_layer, GTextOverflowModeFill);
  layer_add_child(forecast_layer, text_layer_get_layer(forecast_day_layer));
  
  status_layer = text_layer_create(GRect(60, -4, 80, 18));
  text_layer_set_text_color(status_layer, GColorWhite);
  text_layer_set_background_color(status_layer, GColorClear);
  text_layer_set_font(status_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(status_layer, GTextAlignmentRight);
  text_layer_set_overflow_mode(status_layer, GTextOverflowModeTrailingEllipsis);
  layer_add_child(forecast_layer, text_layer_get_layer(status_layer));
  
  high_label_layer = text_layer_create(GRect(92, 5, 10, 24));
  text_layer_set_text_color(high_label_layer, GColorWhite);
  text_layer_set_background_color(high_label_layer, GColorClear);
  text_layer_set_font(high_label_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(high_label_layer, GTextAlignmentLeft);
  text_layer_set_overflow_mode(high_label_layer, GTextOverflowModeFill);
  text_layer_set_text(high_label_layer, "H");
  layer_set_hidden(text_layer_get_layer(high_label_layer), true);
  layer_add_child(forecast_layer, text_layer_get_layer(high_label_layer));
  
  high_temp_layer = text_layer_create(GRect(100, 5, 42, 24));
  text_layer_set_text_color(high_temp_layer, GColorWhite);
  text_layer_set_background_color(high_temp_layer, GColorClear);
  text_layer_set_font(high_temp_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(high_temp_layer, GTextAlignmentRight);
  text_layer_set_overflow_mode(high_temp_layer, GTextOverflowModeFill);
  layer_add_child(forecast_layer, text_layer_get_layer(high_temp_layer));
  
  low_label_layer = text_layer_create(GRect(92, 22, 10, 24));
  text_layer_set_text_color(low_label_layer, GColorWhite);
  text_layer_set_background_color(low_label_layer, GColorClear);
  text_layer_set_font(low_label_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(low_label_layer, GTextAlignmentLeft);
  text_layer_set_overflow_mode(low_label_layer, GTextOverflowModeFill);
  text_layer_set_text(low_label_layer, "L");
  layer_set_hidden(text_layer_get_layer(low_label_layer), true);
  layer_add_child(forecast_layer, text_layer_get_layer(low_label_layer));
  
  low_temp_layer = text_layer_create(GRect(100, 22, 42, 24));
  text_layer_set_text_color(low_temp_layer, GColorWhite);
  text_layer_set_background_color(low_temp_layer, GColorClear);
  text_layer_set_font(low_temp_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(low_temp_layer, GTextAlignmentRight);
  text_layer_set_overflow_mode(low_temp_layer, GTextOverflowModeFill);
  layer_add_child(forecast_layer, text_layer_get_layer(low_temp_layer));
  
  condition_layer = text_layer_create(GRect(0, 42, 144, 24));
  text_layer_set_text_color(condition_layer, GColorWhite);
  text_layer_set_background_color(condition_layer, GColorClear);
  text_layer_set_font(condition_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(condition_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(condition_layer, GTextOverflowModeTrailingEllipsis);
  layer_add_child(forecast_layer, text_layer_get_layer(condition_layer));
  
  layer_add_child(window_layer, forecast_layer);
  
  cal_layer = layer_create(GRect(0, 122, 144, 47));
  layer_add_child(window_layer, cal_layer);
  curr_date_layer = inverter_layer_create(GRect(0, 23, 19, 11));
  layer_add_child(cal_layer, inverter_layer_get_layer(curr_date_layer));
  
  layer_set_update_proc(cal_layer, cal_layer_draw);
  
  nightmode_layer = inverter_layer_create(GRect(0, 0, 144, 168));
  layer_set_hidden(inverter_layer_get_layer(nightmode_layer), true);
  layer_add_child(window_layer, inverter_layer_get_layer(nightmode_layer));
  
  Tuplet initial_values[] = {
    TupletCString(WEATHER_STATUS_KEY, "Fetching..."),
    TupletCString(WEATHER_CURR_TEMP_KEY, ""),
    TupletCString(WEATHER_SUN_RISE_SET_KEY, ""),
    TupletCString(WEATHER_FORECAST_DAY_KEY, ""),
    TupletCString(WEATHER_HIGH_TEMP_KEY, ""),
    TupletCString(WEATHER_LOW_TEMP_KEY, ""),
    TupletInteger(WEATHER_ICON_KEY, (uint8_t) 1),
    TupletCString(WEATHER_CONDITION_KEY, ""),
    TupletInteger(WEATHER_NIGHTMODE_KEY, (uint8_t) 0),
    TupletCString(WEATHER_CITY_KEY, "")
  };
  
  //text_layer_set_text(status_layer, "Fetching...");
  
  
  
  app_sync_init(&sync, sync_buffer, sizeof(sync_buffer), initial_values, ARRAY_LENGTH(initial_values),
      sync_tuple_changed_callback, sync_error_callback, NULL);

  //send_cmd();
  
  handle_tick(t, MINUTE_UNIT | HOUR_UNIT | DAY_UNIT);
}

static void window_unload(Window *window) {
  app_sync_deinit(&sync);

  /*if (icon_bitmap) {
    gbitmap_destroy(icon_bitmap);
  }*/
  
  if (batt_icon)
    gbitmap_destroy(batt_icon);
  
  if (bt_icon)
    gbitmap_destroy(bt_icon);
  
  text_layer_destroy(clock_layer);
  text_layer_destroy(date_layer);
  text_layer_destroy(pm_layer);
  text_layer_destroy(curr_temp_layer);
  text_layer_destroy(sun_rise_set_layer);
  bitmap_layer_destroy(bt_layer);
  bitmap_layer_destroy(batt_layer);
  layer_destroy(current_layer);
  
  text_layer_destroy(forecast_day_layer);
  text_layer_destroy(status_layer);
  text_layer_destroy(high_label_layer);
  text_layer_destroy(high_temp_layer);
  text_layer_destroy(low_label_layer);
  text_layer_destroy(low_temp_layer);
  text_layer_destroy(condition_layer);
  layer_destroy(forecast_layer);
  
  /*text_layer_destroy(city_layer);
  text_layer_destroy(temperature_layer);
  bitmap_layer_destroy(icon_layer);*/
  
  inverter_layer_destroy(curr_date_layer);
  layer_destroy(cal_layer);
  
  inverter_layer_destroy(nightmode_layer);
}

static void init(void) {
  window = window_create();
  window_set_background_color(window, GColorBlack);
  window_set_fullscreen(window, true);
  window_set_window_handlers(window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload
  });

  tick_timer_service_subscribe(MINUTE_UNIT | HOUR_UNIT | DAY_UNIT, handle_tick);
  
  bt_icon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_BT);
  bluetooth_connection_service_subscribe(handle_bt_update);
  
  const int inbound_size = 256;
  const int outbound_size = 256;
  app_message_open(inbound_size, outbound_size);

  const bool animated = true;
  window_stack_push(window, animated);
}

static void deinit(void) {
  if (bt_icon) {
    gbitmap_destroy(bt_icon);
  }
  window_destroy(window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
