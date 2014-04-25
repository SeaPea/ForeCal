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
//static TextLayer *temperature_layer;
//static TextLayer *city_layer;
//static BitmapLayer *icon_layer;
//static GBitmap *icon_bitmap = NULL;

//static AppSync sync;
//static uint8_t sync_buffer[64];

static char current_time[6];
static char current_date[] = "Sun Jan 10";

/*enum WeatherKey {
  WEATHER_ICON_KEY = 0x0,         // TUPLE_INT
  WEATHER_TEMPERATURE_KEY = 0x1,  // TUPLE_CSTRING
  WEATHER_CITY_KEY = 0x2,         // TUPLE_CSTRING
};

static const uint32_t WEATHER_ICONS[] = {
  RESOURCE_ID_IMAGE_SUN, //0
  RESOURCE_ID_IMAGE_CLOUD, //1
  RESOURCE_ID_IMAGE_RAIN, //2
  RESOURCE_ID_IMAGE_SNOW //3
};*/
/*
static void sync_error_callback(DictionaryResult dict_error, AppMessageResult app_message_error, void *context) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "App Message Sync Error: %d", app_message_error);
}

static void sync_tuple_changed_callback(const uint32_t key, const Tuple* new_tuple, const Tuple* old_tuple, void* context) {
  switch (key) {
    case WEATHER_ICON_KEY:
      if (icon_bitmap) {
        gbitmap_destroy(icon_bitmap);
      }
      icon_bitmap = gbitmap_create_with_resource(WEATHER_ICONS[new_tuple->value->uint8]);
      bitmap_layer_set_bitmap(icon_layer, icon_bitmap);
      break;

    case WEATHER_TEMPERATURE_KEY:
      // App Sync keeps new_tuple in sync_buffer, so we may use it directly
      text_layer_set_text(temperature_layer, new_tuple->value->cstring);
      break;

    case WEATHER_CITY_KEY:
      text_layer_set_text(city_layer, new_tuple->value->cstring);
      break;
  }
}

static void send_cmd(void) {
  Tuplet value = TupletInteger(1, 1);

  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);

  if (iter == NULL) {
    return;
  }

  dict_write_tuplet(iter, &value);
  dict_write_end(iter);

  app_message_outbox_send();
}*/

static void handle_minute_tick(struct tm *tick_time, TimeUnits units_changed) {
  clock_copy_time_string(current_time, 6);
  text_layer_set_text(clock_layer, current_time);
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Current time: %s", current_time);
}

static void handle_hour_tick(struct tm *tick_time, TimeUnits units_changed) {
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

static void handle_day_tick(struct tm *tick_time, TimeUnits units_changed) {
  strftime(current_date, sizeof(current_date), "%a %b %d", tick_time);
  text_layer_set_text(date_layer, current_date);
}

static void update_bt_icon() {
  if (bluetooth_connection_service_peek()) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Connected");
    bitmap_layer_set_bitmap(bt_layer, bt_icon);
  }
  else {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT DISCONNECTED");
    bitmap_layer_set_bitmap(bt_layer, NULL);
    vibes_long_pulse();
  }
}

static void handle_bt_timeout(void *data) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Update - 15sec");
  bt_timer = NULL;
  update_bt_icon();
}

static void handle_bt_update(bool connected) {
  if (bt_timer) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Timer Rescheduled");
    app_timer_reschedule(bt_timer, 15000);
  }
  else {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Timer Scheduled");
    bt_timer = app_timer_register(15000, handle_bt_timeout, NULL);
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

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  
  // Get current time
  struct tm *t;
  time_t temp;
  temp = time(NULL);
  t = localtime(&temp);
  
  current_layer = layer_create(GRect(0, 0, 144, 58));
  layer_add_child(window_layer, current_layer);
  
  clock_layer = text_layer_create(GRect(-1, -14, 126, 50));
  text_layer_set_text_color(clock_layer, GColorWhite);
  text_layer_set_background_color(clock_layer, GColorClear);
  text_layer_set_font(clock_layer, fonts_get_system_font(FONT_KEY_ROBOTO_BOLD_SUBSET_49));
  text_layer_set_text_alignment(clock_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(clock_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(clock_layer));
  handle_minute_tick(t, MINUTE_UNIT);
  
  pm_layer = text_layer_create(GRect(123, 23, 20, 15));
  text_layer_set_text_color(pm_layer, GColorWhite);
  text_layer_set_background_color(pm_layer, GColorClear);
  text_layer_set_font(pm_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(pm_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(pm_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(pm_layer));
  handle_hour_tick(t, HOUR_UNIT);
  
  date_layer = text_layer_create(GRect(72, 30, 72, 26));
  text_layer_set_text_color(date_layer, GColorWhite);
  text_layer_set_background_color(date_layer, GColorClear);
  text_layer_set_font(date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(date_layer, GTextAlignmentRight);
  text_layer_set_overflow_mode(date_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(date_layer));
  handle_day_tick(t, DAY_UNIT);
  
  bt_layer = bitmap_layer_create(GRect(129, 1, 9, 16));
  layer_add_child(current_layer, bitmap_layer_get_layer(bt_layer));
  update_bt_icon();
  
  batt_layer = bitmap_layer_create(GRect(126, 18, 16, 8));
  layer_add_child(current_layer, bitmap_layer_get_layer(batt_layer));
  BatteryChargeState batt_state = battery_state_service_peek();
  handle_batt_update(batt_state);
  
  layer_set_update_proc(current_layer, current_layer_draw);
  
  /*icon_layer = bitmap_layer_create(GRect(32, 10, 40, 40));
  layer_add_child(window_layer, bitmap_layer_get_layer(icon_layer));

  temperature_layer = text_layer_create(GRect(0, 55, 144, 68));
  text_layer_set_text_color(temperature_layer, GColorWhite);
  text_layer_set_background_color(temperature_layer, GColorClear);
  text_layer_set_font(temperature_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
  text_layer_set_text_alignment(temperature_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(temperature_layer));

  city_layer = text_layer_create(GRect(0, 85, 144, 68));
  text_layer_set_text_color(city_layer, GColorWhite);
  text_layer_set_background_color(city_layer, GColorClear);
  text_layer_set_font(city_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(city_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(city_layer));

  Tuplet initial_values[] = {
    TupletInteger(WEATHER_ICON_KEY, (uint8_t) 1),
    TupletCString(WEATHER_TEMPERATURE_KEY, "???\u00B0F"),
    TupletCString(WEATHER_CITY_KEY, "Fetching..."),
  };
  
  app_sync_init(&sync, sync_buffer, sizeof(sync_buffer), initial_values, ARRAY_LENGTH(initial_values),
      sync_tuple_changed_callback, sync_error_callback, NULL);

  send_cmd();*/
}

static void window_unload(Window *window) {
  /*app_sync_deinit(&sync);

  if (icon_bitmap) {
    gbitmap_destroy(icon_bitmap);
  }*/
  
  if (batt_icon) {
    gbitmap_destroy(batt_icon);
  }
  
  text_layer_destroy(clock_layer);
  /*text_layer_destroy(city_layer);
  text_layer_destroy(temperature_layer);
  bitmap_layer_destroy(icon_layer);*/
}

static void init(void) {
  window = window_create();
  window_set_background_color(window, GColorBlack);
  window_set_fullscreen(window, true);
  window_set_window_handlers(window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload
  });

  tick_timer_service_subscribe(MINUTE_UNIT, handle_minute_tick);
  tick_timer_service_subscribe(HOUR_UNIT, handle_hour_tick);
  tick_timer_service_subscribe(DAY_UNIT, handle_day_tick);
  
  bt_icon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_BT);
  bluetooth_connection_service_subscribe(handle_bt_update);
  
  /*const int inbound_size = 64;
  const int outbound_size = 64;
  app_message_open(inbound_size, outbound_size);*/

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
