#include "pebble.h"

static Window *window;

static TextLayer *clock_layer = NULL;
static GBitmap *bt_icon = NULL;
static BitmapLayer *bt_layer;
static GBitmap *batt_icon = NULL;
static BitmapLayer *batt_layer;
//static TextLayer *temperature_layer;
//static TextLayer *city_layer;
//static BitmapLayer *icon_layer;
//static GBitmap *icon_bitmap = NULL;

//static AppSync sync;
//static uint8_t sync_buffer[64];

static char current_time[6];

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
  clock_copy_time_string(current_time, 5);
  text_layer_set_text(clock_layer, current_time);
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Current time: %s", current_time);
}

static void handle_bt_update(bool connected) {
  if (connected) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Connected");
    bitmap_layer_set_bitmap(bt_layer, bt_icon);
  }
  else {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT DISCONNECTED");
    bitmap_layer_set_bitmap(bt_layer, NULL);
    vibes_long_pulse();
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

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  
  clock_layer = text_layer_create(GRect(0, -12, 122, 50));
  text_layer_set_text_color(clock_layer, GColorWhite);
  text_layer_set_background_color(clock_layer, GColorBlack);
  text_layer_set_font(clock_layer, fonts_get_system_font(FONT_KEY_ROBOTO_BOLD_SUBSET_49));
  text_layer_set_text_alignment(clock_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(clock_layer));
  handle_minute_tick(NULL, MINUTE_UNIT);
  
  bt_layer = bitmap_layer_create(GRect(128, 1,9, 16));
  layer_add_child(window_layer, bitmap_layer_get_layer(bt_layer));
  handle_bt_update(bluetooth_connection_service_peek());
  
  batt_layer = bitmap_layer_create(GRect(125, 20, 16, 8));
  layer_add_child(window_layer, bitmap_layer_get_layer(batt_layer));
  BatteryChargeState batt_state = battery_state_service_peek();
  handle_batt_update(batt_state);
  
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
