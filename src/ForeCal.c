#include "pebble.h"

// #define DEBUG
  
#define MyTupletCString(_key, _cstring) \
((const Tuplet) { .type = TUPLE_CSTRING, .key = _key, .cstring = { .data = _cstring, .length = strlen(_cstring) + 1 }})
  
static Window *window;

static bool loading = false;

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

static Layer *forecast_layer = NULL;
static TextLayer *forecast_day_layer = NULL;
static TextLayer *status_layer = NULL;
static AppTimer *weatherinit_timer = NULL;
static AppTimer *status_timer = NULL;
static TextLayer *condition_layer = NULL;
static TextLayer *high_temp_layer = NULL;
static TextLayer *high_label_layer = NULL;
static TextLayer *low_temp_layer = NULL;
static TextLayer *low_label_layer = NULL;
static TextLayer *sun_rise_set_layer = NULL;

static BitmapLayer *icon_layer;
static GBitmap *icon_bitmap = NULL;

static BitmapLayer *sun_layer;
static GBitmap *sun_bitmap = NULL;

static Layer *cal_layer = NULL;
static InverterLayer *curr_date_layer = NULL;

static InverterLayer *daymode_layer = NULL;

static const uint32_t bt_warn_pattern[] = { 1000, 500, 1000 };
static int startday = 0;
static char *weekdays[7] = {"Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"};

static AppSync sync;
static uint8_t sync_buffer[256];

static char current_time[] = "00:00";
static char current_date[] = "Sun Jan 01";

static char status[50] = "Fetching...";
static char city[50] = "";
static char curr_temp[10] = "";
static char sun_rise_set[6] = "";
static char forecast_day[9] = "";
static char high_temp[10] = "";
static char low_temp[10] = "";
static int icon = 0;
static char condition[50] = "";
static int daymode = 0;
static int sun_rise_hour = 99;
static int sun_rise_min = 99;
static int sun_set_hour = 99;
static int sun_set_min = 99;
static int auto_daymode = 99;
static int prev_daytime = 99;

// App Message Keys for Tuples transferred from Javascript
enum WeatherKey {
  WEATHER_STATUS_KEY = 0,
  WEATHER_CURR_TEMP_KEY = 1,
  WEATHER_SUN_RISE_SET_KEY = 2,
  WEATHER_FORECAST_DAY_KEY = 3,
  WEATHER_HIGH_TEMP_KEY = 4,
  WEATHER_LOW_TEMP_KEY = 5,
  WEATHER_ICON_KEY = 6,
  WEATHER_CONDITION_KEY = 7,
  WEATHER_DAYMODE_KEY = 8,
  WEATHER_CITY_KEY = 9,
  WEATHER_SUN_RISE_HOUR_KEY = 10,
  WEATHER_SUN_RISE_MIN_KEY = 11,
  WEATHER_SUN_SET_HOUR_KEY = 12,
  WEATHER_SUN_SET_MIN_KEY = 13,
  WEATHER_AUTO_DAYMODE_KEY = 14
};

// Weather icon resources defined in order to match Javascript icon values
static const uint32_t WEATHER_ICONS[] = {
  RESOURCE_ID_IMAGE_NA, //0
  RESOURCE_ID_IMAGE_SUNNY, //1
  RESOURCE_ID_IMAGE_PARTLYCLOUDY, //2
  RESOURCE_ID_IMAGE_CLOUDY, //3
  RESOURCE_ID_IMAGE_WINDY, //4
  RESOURCE_ID_IMAGE_LOWVISIBILITY, //5
  RESOURCE_ID_IMAGE_ISOLATEDTHUNDERSTORMS, //6
  RESOURCE_ID_IMAGE_SCATTEREDTHUNDERSTORMS, //7
  RESOURCE_ID_IMAGE_DRIZZLE, //8
  RESOURCE_ID_IMAGE_RAIN, //9
  RESOURCE_ID_IMAGE_HAIL, //10
  RESOURCE_ID_IMAGE_SNOW, //11
  RESOURCE_ID_IMAGE_MIXEDSNOW, //12
  RESOURCE_ID_IMAGE_COLD, //13
  RESOURCE_ID_IMAGE_TORNADO, //14
  RESOURCE_ID_IMAGE_STORM, //15
  RESOURCE_ID_IMAGE_LIGHTSNOW, //16
  RESOURCE_ID_IMAGE_HOT, //17
  RESOURCE_ID_IMAGE_HURRICANE //18
};

// Timer event that shows status after displaying the City/Error for 5 seconds
static void handle_status_timer(void *data) {
#ifdef DEBUG
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Status timer event fired");
#endif
  if (status != NULL && strlen(status) > 0)
    text_layer_set_text(status_layer, status);
  else {
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Status is blank");
#endif
  }
  
  status_timer = NULL;
  if (!loading) {
    // Save weather data after initial call and after a brief delay since 
    // writing is slow and can interfere with other things
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Saving weather data");
#endif
    persist_write_int(WEATHER_ICON_KEY, icon);
    persist_write_string(WEATHER_STATUS_KEY, status);
    persist_write_string(WEATHER_CITY_KEY, city);
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Saving Current Temp: %s", curr_temp);
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Current Temp Storage Result: %d", persist_write_string(WEATHER_CURR_TEMP_KEY, curr_temp));
#else
    persist_write_string(WEATHER_CURR_TEMP_KEY, curr_temp);
#endif
    persist_write_string(WEATHER_SUN_RISE_SET_KEY, sun_rise_set);
    persist_write_string(WEATHER_FORECAST_DAY_KEY, forecast_day);
    persist_write_string(WEATHER_HIGH_TEMP_KEY, high_temp);
    persist_write_string(WEATHER_LOW_TEMP_KEY, low_temp);
    persist_write_string(WEATHER_CONDITION_KEY, condition);
    persist_write_int(WEATHER_DAYMODE_KEY, daymode);
    persist_write_int(WEATHER_SUN_RISE_HOUR_KEY, sun_rise_hour);
    persist_write_int(WEATHER_SUN_RISE_MIN_KEY, sun_rise_min);
    persist_write_int(WEATHER_SUN_SET_HOUR_KEY, sun_set_hour);
    persist_write_int(WEATHER_SUN_SET_MIN_KEY, sun_set_min);
    persist_write_int(WEATHER_AUTO_DAYMODE_KEY, auto_daymode);
  }
}

// Timer event that fires after the initial tuple callback below
static void handle_weatherinit_timer(void *data) {
#ifdef DEBUG
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Weather init timer event fired");
#endif
  loading = false;
  weatherinit_timer = NULL;
}

// App message communication error from Javascript
static void sync_error_callback(DictionaryResult dict_error, AppMessageResult app_message_error, void *context) {
  APP_LOG(APP_LOG_LEVEL_ERROR, "App Message Sync Error: %d", app_message_error);
  text_layer_set_text(status_layer, "Comm error");
}

static void update_sun_layer(struct tm *t) {
  if (sun_rise_hour != 99 && sun_rise_hour != 99 && sun_set_hour != 99 && sun_set_min != 99) {
    
    if (t == NULL) {
      // Get current time
      time_t temp;
      temp = time(NULL);
      t = localtime(&temp);
    }
    
#ifdef DEBUG
      APP_LOG(APP_LOG_LEVEL_DEBUG, "Sun Rise Hour: %d, Sun Rise Minute: %d", sun_rise_hour, sun_rise_min);
      APP_LOG(APP_LOG_LEVEL_DEBUG, "Sun Set Hour: %d, Sun Set Minute: %d", sun_set_hour, sun_set_min);
#endif
    
    bool daytime = true;
    
    if (t->tm_hour < sun_rise_hour || (t->tm_hour == sun_rise_hour && t->tm_min <= sun_rise_min) ||
        t->tm_hour > sun_set_hour || (t->tm_hour == sun_set_hour && t->tm_min >= sun_set_min))
      daytime = false;
    
    if ((daytime && prev_daytime != 1) || (!daytime && prev_daytime != 0)) {
#ifdef DEBUG
      APP_LOG(APP_LOG_LEVEL_DEBUG, "Updating sun layer");
#endif
      
      if (sun_bitmap)
          gbitmap_destroy(sun_bitmap);
      
      if (t->tm_hour < sun_rise_hour || (t->tm_hour == sun_rise_hour && t->tm_min <= sun_rise_min) ||
          t->tm_hour > sun_set_hour || (t->tm_hour == sun_set_hour && t->tm_min >= sun_set_min)) {
        // Night
        snprintf(sun_rise_set, sizeof(sun_rise_set), "%d:%.2d", sun_rise_hour, sun_rise_min);
        sun_bitmap = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_SUNRISE);
        prev_daytime = 0;
      } else {
        // Day
        snprintf(sun_rise_set, sizeof(sun_rise_set), "%d:%.2d", sun_set_hour, sun_set_min);
        sun_bitmap = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_SUNSET);
        prev_daytime = 1;
      }
      
      if (auto_daymode == 1) 
        layer_set_hidden(inverter_layer_get_layer(daymode_layer), !daytime);
      
      bitmap_layer_set_bitmap(sun_layer, sun_bitmap);
      text_layer_set_text(sun_rise_set_layer, sun_rise_set);
      layer_set_hidden(bitmap_layer_get_layer(sun_layer), false);
    }
  } else {
    text_layer_set_text(sun_rise_set_layer, "");
    layer_set_hidden(bitmap_layer_get_layer(sun_layer), true);
  }
}

// Event fired when data received from Javascript
static void sync_tuple_changed_callback(const uint32_t key, const Tuple* new_tuple, const Tuple* old_tuple, void* context) {
  switch (key) {
    case WEATHER_ICON_KEY:
      if (icon_bitmap) {
        gbitmap_destroy(icon_bitmap);
      }
      icon = new_tuple->value->uint8;
      layer_set_hidden(bitmap_layer_get_layer(icon_layer), (icon == 0));
      icon_bitmap = gbitmap_create_with_resource(WEATHER_ICONS[icon]);
      bitmap_layer_set_bitmap(icon_layer, icon_bitmap);
      break;
    case WEATHER_STATUS_KEY:
      // Save status for displaying after showing City for 5 seconds
      strncpy(status, new_tuple->value->cstring, sizeof(status));
      break;
    case WEATHER_CITY_KEY:
      strncpy(city, new_tuple->value->cstring, sizeof(city));
      text_layer_set_text(status_layer, city);
      // Show City for 5 seconds and then replace with Status
      if (status_timer) {
        app_timer_reschedule(status_timer, 5000);
      }
      else {
        status_timer = app_timer_register(5000, handle_status_timer, NULL);
      }
      break;
    case WEATHER_CURR_TEMP_KEY:
      strncpy(curr_temp, new_tuple->value->cstring, sizeof(curr_temp));
      text_layer_set_text(curr_temp_layer, curr_temp); 
#ifdef DEBUG
      APP_LOG(APP_LOG_LEVEL_DEBUG, "Displaying Current Temp: %s", curr_temp);
#endif
      break;
    /*case WEATHER_SUN_RISE_SET_KEY:
      // Show the sunrise or sunset time (only the next sunrise/sunset is shown)
      strncpy(sun_rise_set, new_tuple->value->cstring, sizeof(sun_rise_set));
      text_layer_set_text(sun_rise_set_layer, sun_rise_set);
      layer_set_hidden(bitmap_layer_get_layer(sun_layer), (strlen(sun_rise_set) == 0));
      break;*/
    case WEATHER_FORECAST_DAY_KEY:
      strncpy(forecast_day, new_tuple->value->cstring, sizeof(forecast_day));
      text_layer_set_text(forecast_day_layer, forecast_day);
      break;
    case WEATHER_HIGH_TEMP_KEY:
      strncpy(high_temp, new_tuple->value->cstring, sizeof(high_temp));
      text_layer_set_text(high_temp_layer, high_temp);
      layer_set_hidden(text_layer_get_layer(high_label_layer), strlen(high_temp) == 0);
      break;
    case WEATHER_LOW_TEMP_KEY:
      strncpy(low_temp, new_tuple->value->cstring, sizeof(low_temp));
      text_layer_set_text(low_temp_layer, low_temp);
      layer_set_hidden(text_layer_get_layer(low_label_layer), strlen(low_temp) == 0);
      break;
    case WEATHER_CONDITION_KEY:
      strncpy(condition, new_tuple->value->cstring, sizeof(condition));
      text_layer_set_text(condition_layer, condition);
      break;
    case WEATHER_DAYMODE_KEY:
      daymode = new_tuple->value->uint8;
      layer_set_hidden(inverter_layer_get_layer(daymode_layer), (daymode == 0));
      if (sun_bitmap)
        gbitmap_destroy(sun_bitmap);
      
      // 'Daymode' is defined as the time being between Sunrise and Sunset so it
      // can be also used to determine the correct Sunrise/Sunset icon to display
      if (daymode == 0)
        sun_bitmap = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_SUNRISE);
      else
        sun_bitmap = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_SUNSET);
      bitmap_layer_set_bitmap(sun_layer, sun_bitmap);
      break;
    case WEATHER_SUN_RISE_HOUR_KEY:
      sun_rise_hour = new_tuple->value->uint8;
      update_sun_layer(NULL);
      break;
    case WEATHER_SUN_RISE_MIN_KEY:
      sun_rise_min = new_tuple->value->uint8;
      update_sun_layer(NULL);
      break;
    case WEATHER_SUN_SET_HOUR_KEY:
      sun_set_hour = new_tuple->value->uint8;
      update_sun_layer(NULL);
      break;
    case WEATHER_SUN_SET_MIN_KEY:
      sun_set_min = new_tuple->value->uint8;
      update_sun_layer(NULL);
      break;
    case WEATHER_AUTO_DAYMODE_KEY:
      auto_daymode = new_tuple->value->uint8;
      update_sun_layer(NULL);
      break;
  }
}

// Procedure that triggers the weather data to update via Javascript
static void update_weather(void) {
  text_layer_set_text(status_layer, "Fetching...");
  
  Tuplet value = TupletCString(WEATHER_CITY_KEY, "Fetching...");

  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);

  if (iter == NULL) {
    return;
  }

  dict_write_tuplet(iter, &value);
  dict_write_end(iter);

  app_message_outbox_send();
}

// Handle clock change events
static void handle_tick(struct tm *tick_time, TimeUnits units_changed) {
  if ((units_changed & MINUTE_UNIT) != 0) {
    clock_copy_time_string(current_time, sizeof(current_time));
    text_layer_set_text(clock_layer, current_time);
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Current time: %s", current_time);
#endif
    if (tick_time->tm_min % 20 == 0) {
      update_weather(); // Update the weather every 20 minutes
    }
    update_sun_layer(tick_time);
  }
  if ((units_changed & HOUR_UNIT) != 0) {
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Hour changed");
#endif
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
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Day changed");
#endif
    strftime(current_date, sizeof(current_date), "%a %b %d", tick_time);
    text_layer_set_text(date_layer, current_date);
    // Trigger redraw of calendar
    layer_mark_dirty(cal_layer);
  }
}

// Show or hide Bluetooth icon based on connection status and vibrate on disconnect
static void update_bt_icon(bool connected) {
  if (connected) {
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Connected");
#endif
    layer_set_hidden(bitmap_layer_get_layer(bt_layer), false);
  }
  else {
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "BT DISCONNECTED");
#endif
    layer_set_hidden(bitmap_layer_get_layer(bt_layer), true);
    
    VibePattern pat = {
      .durations = bt_warn_pattern,
      .num_segments = ARRAY_LENGTH(bt_warn_pattern),
    };
    vibes_enqueue_custom_pattern(pat);
  }
}

// Handle Bluetooth disconnect timer to show disconnect after 15 seconds
static void handle_bt_timeout(void *data) {
#ifdef DEBUG
  APP_LOG(APP_LOG_LEVEL_DEBUG, "BT Update - 15sec");
#endif
  bt_timer = NULL;
  update_bt_icon(bluetooth_connection_service_peek());
}

// Handle Bluetooth status updates
static void handle_bt_update(bool connected) {
  if (connected) {
    // If connected, immediately update BT icon
    if (bt_timer)
      app_timer_cancel(bt_timer);
    
    update_bt_icon(connected);
  }
  else {
    // If disconnected, wait 15 seconds to update BT icon in case of reconnect
    if (bt_timer) {
      app_timer_reschedule(bt_timer, 15000);
    }
    else {
      bt_timer = app_timer_register(15000, handle_bt_timeout, NULL);
    }
  }
}

// Handle battery status updates
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

// Handle drawing of the 3 week calendar layer
static void cal_layer_draw(Layer *layer, GContext *ctx) {
  // Paint calendar background
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_rect(ctx, GRect(0, 0, 144, 46), 0, GCornerNone);
  
  // Paint inverted rows background
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, GRect(0, 11, 144, 11), 0, GCornerNone);
  graphics_fill_rect(ctx, GRect(0, 35, 144, 11), 0, GCornerNone);
  
  // Draw day separators
  /*graphics_context_set_stroke_color(ctx, GColorWhite);
  for (int c = 1; c < 7; c++) {
    graphics_draw_line(ctx, GPoint((c*20) + c - 1, 11), GPoint((c*20) + c - 1, 46));
  }*/
  
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
  
  loading = true;
  
  // Setup 'current' layer (time, date, current temp, battery, bluetooth)
  current_layer = layer_create(GRect(0, 0, 144, 58));
  
  clock_layer = text_layer_create(GRect(-1, -13, 126, 50));
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
  
  date_layer = text_layer_create(GRect(55, 30, 89, 26));
  text_layer_set_text_color(date_layer, GColorWhite);
  text_layer_set_background_color(date_layer, GColorClear);
  text_layer_set_font(date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(date_layer, GTextAlignmentRight);
  text_layer_set_overflow_mode(date_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(date_layer));
  
  bt_layer = bitmap_layer_create(GRect(129, 1, 9, 16));
  layer_add_child(current_layer, bitmap_layer_get_layer(bt_layer));
  bitmap_layer_set_bitmap(bt_layer, bt_icon);
  update_bt_icon(bluetooth_connection_service_peek());
  
  batt_layer = bitmap_layer_create(GRect(126, 18, 16, 8));
  layer_add_child(current_layer, bitmap_layer_get_layer(batt_layer));
  BatteryChargeState batt_state = battery_state_service_peek();
  handle_batt_update(batt_state);
  battery_state_service_subscribe(handle_batt_update);
  
  curr_temp_layer = text_layer_create(GRect(0, 30, 45, 26));
  text_layer_set_text_color(curr_temp_layer, GColorWhite);
  text_layer_set_background_color(curr_temp_layer, GColorClear);
  text_layer_set_font(curr_temp_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(curr_temp_layer, GTextAlignmentLeft);
  text_layer_set_overflow_mode(curr_temp_layer, GTextOverflowModeFill);
  layer_add_child(current_layer, text_layer_get_layer(curr_temp_layer));
  
  layer_add_child(window_layer, current_layer);
  
  // Setup forecast layer (High/Low Temp, conditions, sunrise/sunset)
  forecast_layer = layer_create(GRect(0, 57, 144, 64));
  
  forecast_day_layer = text_layer_create(GRect(0, -4, 64, 17));
  text_layer_set_text_color(forecast_day_layer, GColorBlack);
  text_layer_set_background_color(forecast_day_layer, GColorWhite);
  text_layer_set_font(forecast_day_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_text_alignment(forecast_day_layer, GTextAlignmentLeft);
  text_layer_set_overflow_mode(forecast_day_layer, GTextOverflowModeFill);
  layer_add_child(forecast_layer, text_layer_get_layer(forecast_day_layer));
  
  status_layer = text_layer_create(GRect(60, -4, 84, 17));
  text_layer_set_text_color(status_layer, GColorBlack);
  text_layer_set_background_color(status_layer, GColorWhite);
  text_layer_set_font(status_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_text_alignment(status_layer, GTextAlignmentRight);
  text_layer_set_overflow_mode(status_layer, GTextOverflowModeTrailingEllipsis);
  layer_add_child(forecast_layer, text_layer_get_layer(status_layer));
  
  high_label_layer = text_layer_create(GRect(1, 6, 10, 24));
  text_layer_set_text_color(high_label_layer, GColorWhite);
  text_layer_set_background_color(high_label_layer, GColorClear);
  text_layer_set_font(high_label_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(high_label_layer, GTextAlignmentLeft);
  text_layer_set_overflow_mode(high_label_layer, GTextOverflowModeFill);
  text_layer_set_text(high_label_layer, "H");
  layer_set_hidden(text_layer_get_layer(high_label_layer), true);
  layer_add_child(forecast_layer, text_layer_get_layer(high_label_layer));
  
  high_temp_layer = text_layer_create(GRect(9, 6, 45, 24));
  text_layer_set_text_color(high_temp_layer, GColorWhite);
  text_layer_set_background_color(high_temp_layer, GColorClear);
  text_layer_set_font(high_temp_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(high_temp_layer, GTextAlignmentRight);
  text_layer_set_overflow_mode(high_temp_layer, GTextOverflowModeFill);
  layer_add_child(forecast_layer, text_layer_get_layer(high_temp_layer));
  
  low_label_layer = text_layer_create(GRect(1, 23, 10, 24));
  text_layer_set_text_color(low_label_layer, GColorWhite);
  text_layer_set_background_color(low_label_layer, GColorClear);
  text_layer_set_font(low_label_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(low_label_layer, GTextAlignmentLeft);
  text_layer_set_overflow_mode(low_label_layer, GTextOverflowModeFill);
  text_layer_set_text(low_label_layer, "L");
  layer_set_hidden(text_layer_get_layer(low_label_layer), true);
  layer_add_child(forecast_layer, text_layer_get_layer(low_label_layer));
  
  low_temp_layer = text_layer_create(GRect(9, 23, 45, 24));
  text_layer_set_text_color(low_temp_layer, GColorWhite);
  text_layer_set_background_color(low_temp_layer, GColorClear);
  text_layer_set_font(low_temp_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24));
  text_layer_set_text_alignment(low_temp_layer, GTextAlignmentRight);
  text_layer_set_overflow_mode(low_temp_layer, GTextOverflowModeFill);
  layer_add_child(forecast_layer, text_layer_get_layer(low_temp_layer));
  
  sun_rise_set_layer = text_layer_create(GRect(109, 26, 36, 18));
  text_layer_set_text_color(sun_rise_set_layer, GColorWhite);
  text_layer_set_background_color(sun_rise_set_layer, GColorClear);
  text_layer_set_font(sun_rise_set_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(sun_rise_set_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(sun_rise_set_layer, GTextOverflowModeFill);
  layer_add_child(forecast_layer, text_layer_get_layer(sun_rise_set_layer));
  
  icon_layer = bitmap_layer_create(GRect(66, 16, 32, 32));
  layer_add_child(forecast_layer, bitmap_layer_get_layer(icon_layer));
  
  sun_layer = bitmap_layer_create(GRect(117, 17, 20, 14));
  layer_add_child(forecast_layer, bitmap_layer_get_layer(sun_layer));
  
  condition_layer = text_layer_create(GRect(0, 43, 144, 24));
  text_layer_set_text_color(condition_layer, GColorWhite);
  text_layer_set_background_color(condition_layer, GColorClear);
  text_layer_set_font(condition_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(condition_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(condition_layer, GTextOverflowModeTrailingEllipsis);
  layer_add_child(forecast_layer, text_layer_get_layer(condition_layer));
  
  layer_add_child(window_layer, forecast_layer);
  
  // Setup 3 week calendar layer
  cal_layer = layer_create(GRect(0, 122, 144, 47));
  layer_add_child(window_layer, cal_layer);
  curr_date_layer = inverter_layer_create(GRect(0, 23, 19, 11));
  layer_add_child(cal_layer, inverter_layer_get_layer(curr_date_layer));
  
  layer_set_update_proc(cal_layer, cal_layer_draw);
  
  daymode_layer = inverter_layer_create(GRect(0, 0, 144, 168));
  layer_set_hidden(inverter_layer_get_layer(daymode_layer), true);
  layer_add_child(window_layer, inverter_layer_get_layer(daymode_layer));
  
  // Get current time
  struct tm *t;
  time_t temp;
  temp = time(NULL);
  t = localtime(&temp);
  
  // Init time and date
  handle_tick(t, MINUTE_UNIT | HOUR_UNIT | DAY_UNIT);
  
  // Get previously fetched results in case of comm error and use as initial values
  if (persist_exists(WEATHER_STATUS_KEY))
    persist_read_string(WEATHER_STATUS_KEY, status, sizeof(status));
  
  if (persist_exists(WEATHER_CURR_TEMP_KEY)) {
    persist_read_string(WEATHER_CURR_TEMP_KEY, curr_temp, sizeof(curr_temp));
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Stored Current Temp: %s", curr_temp);
#endif
  } else {
#ifdef DEBUG
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Current temp not stored");
#endif
  }
  
  /*if (persist_exists(WEATHER_SUN_RISE_SET_KEY))
    persist_read_string(WEATHER_SUN_RISE_SET_KEY, sun_rise_set, sizeof(sun_rise_set));*/
  
  if (persist_exists(WEATHER_FORECAST_DAY_KEY))
    persist_read_string(WEATHER_FORECAST_DAY_KEY, forecast_day, sizeof(forecast_day));
  
  if (persist_exists(WEATHER_HIGH_TEMP_KEY))
    persist_read_string(WEATHER_HIGH_TEMP_KEY, high_temp, sizeof(high_temp));
  
  if (persist_exists(WEATHER_LOW_TEMP_KEY))
    persist_read_string(WEATHER_LOW_TEMP_KEY, low_temp, sizeof(low_temp));
  
  if (persist_exists(WEATHER_ICON_KEY))
    icon = persist_read_int(WEATHER_ICON_KEY);
  
  if (persist_exists(WEATHER_CONDITION_KEY))
    persist_read_string(WEATHER_CONDITION_KEY, condition, sizeof(condition));
  
  if (persist_exists(WEATHER_DAYMODE_KEY))
    daymode = persist_read_int(WEATHER_DAYMODE_KEY);
  
  if (persist_exists(WEATHER_SUN_RISE_HOUR_KEY))
    sun_rise_hour = persist_read_int(WEATHER_SUN_RISE_HOUR_KEY);
  
  if (persist_exists(WEATHER_SUN_RISE_MIN_KEY))
    sun_rise_min = persist_read_int(WEATHER_SUN_RISE_MIN_KEY);
  
  if (persist_exists(WEATHER_SUN_SET_HOUR_KEY))
    sun_set_hour = persist_read_int(WEATHER_SUN_SET_HOUR_KEY);
  
  if (persist_exists(WEATHER_SUN_SET_MIN_KEY))
    sun_set_min = persist_read_int(WEATHER_SUN_SET_MIN_KEY);
  
  if (persist_exists(WEATHER_AUTO_DAYMODE_KEY))
    auto_daymode = persist_read_int(WEATHER_AUTO_DAYMODE_KEY);
  
  // Initialize weather data fetching
  Tuplet initial_values[] = {
    MyTupletCString(WEATHER_STATUS_KEY, status),
    MyTupletCString(WEATHER_CURR_TEMP_KEY, curr_temp),
    //MyTupletCString(WEATHER_SUN_RISE_SET_KEY, sun_rise_set),
    MyTupletCString(WEATHER_FORECAST_DAY_KEY, forecast_day),
    MyTupletCString(WEATHER_HIGH_TEMP_KEY, high_temp),
    MyTupletCString(WEATHER_LOW_TEMP_KEY, low_temp),
    TupletInteger(WEATHER_ICON_KEY, (uint8_t) icon),
    MyTupletCString(WEATHER_CONDITION_KEY, condition),
    TupletInteger(WEATHER_DAYMODE_KEY, (uint8_t) daymode),
    TupletCString(WEATHER_CITY_KEY, "Fetching..."),
    TupletInteger(WEATHER_SUN_RISE_HOUR_KEY, (uint8_t) sun_rise_hour),
    TupletInteger(WEATHER_SUN_RISE_MIN_KEY, (uint8_t) sun_rise_min),
    TupletInteger(WEATHER_SUN_SET_HOUR_KEY, (uint8_t) sun_set_hour),
    TupletInteger(WEATHER_SUN_SET_MIN_KEY, (uint8_t) sun_set_min),
    TupletInteger(WEATHER_AUTO_DAYMODE_KEY, (uint8_t) auto_daymode),
  };
  
  // Initialize and trigger weather data Javascript call
  app_sync_init(&sync, sync_buffer, sizeof(sync_buffer), initial_values, ARRAY_LENGTH(initial_values),
      sync_tuple_changed_callback, sync_error_callback, NULL);
  
  // Fire timer half a second after the app_sync_init to mark everything as loaded once the initial tuple callback is done
  weatherinit_timer = app_timer_register(500, handle_weatherinit_timer, NULL);
}

static void window_unload(Window *window) {
  // Release event based resources
  app_sync_deinit(&sync);
  
  if (bt_timer)
    app_timer_cancel(bt_timer);
  
  if (status_timer)
    app_timer_cancel(status_timer);
  
  if (weatherinit_timer)
    app_timer_cancel(weatherinit_timer);

  battery_state_service_unsubscribe();
  
  // Release image resources
  if (icon_bitmap)
    gbitmap_destroy(icon_bitmap);
  
  if (sun_bitmap)
    gbitmap_destroy(sun_bitmap);
  
  if (batt_icon)
    gbitmap_destroy(batt_icon);
  
  // Release UI resources
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
  bitmap_layer_destroy(icon_layer);
  bitmap_layer_destroy(sun_layer);
  layer_destroy(forecast_layer);
  
  inverter_layer_destroy(curr_date_layer);
  layer_destroy(cal_layer);
  
  inverter_layer_destroy(daymode_layer);
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
  tick_timer_service_unsubscribe();
  bluetooth_connection_service_unsubscribe();
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
