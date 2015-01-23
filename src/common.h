#include <pebble.h>

//#define DEBUG
#ifndef DEBUG
#undef APP_LOG
#define APP_LOG(...)
#endif
    
#define MyTupletCString(_key, _cstring) \
((const Tuplet) { .type = TUPLE_CSTRING, .key = _key, .cstring = { .data = _cstring, .length = strlen(_cstring) + 1 }})

typedef struct savedata {
    uint8_t icon;
    char status[50];
    char city[50];
    char curr_temp[10];
    char sun_rise_set[7];
    char forecast_day[9];
    char high_temp[10];
    char low_temp[10];
    char condition[50];
    bool daymode;
    uint8_t sun_rise_hour;
    uint8_t sun_rise_min;
    uint8_t sun_set_hour;
    uint8_t sun_set_min;
    bool auto_daymode;
    uint8_t update_interval;
    uint8_t startday;
    uint8_t cal_offset;
    bool show_bt;
    bool show_batt;
    bool bt_vibes;
 } __attribute__((__packed__)) savedata_t;
