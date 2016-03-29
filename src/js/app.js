var DEBUG = true;

// DO NOT REUSE THIS KEY IF FORKING OR COPYING THIS CODE SOMEWHERE ELSE.
// APPLY FOR YOUR OWN KEY at OpenWeatherMap.org
var API_KEY = "106caae1620867404688360dcbd4bb3e";

var Clay = require('clay');
var clayConfig = require('config');
var clay = new Clay(clayConfig, null, { autoHandleEvents: false });


var daymode = 0;
var locationOptions = { "timeout": 15000, "maximumAge": 60000 }; 
var lastStationId = null;
var locChanged = 0;
var time24hr = true;
var lastUpdate = null;
var lastForecastUpdate = null;
var lastUnits = 'imperial';

var config = { 
  ColorScheme: 'Auto',
  ShowBT: 1,
  BTVibes: 1,
  ShowBatt: 1,
  ForecastHour: 18,
  ForecastMin: 0,
  WeatherLoc: '',
  TempUnit: 'Auto',
  UpdateInterval: 20,
  FirstDay: 0,
  CalOffset: 0,
  ShowWind: 0,
  DateFormat: 0,
  QTStartHour: 0,
  QTStartMin: 15,
  QTEndHour: 6,
  QTEndMin: 30,
  QTVibes: 0,
  QTFetch: 0
};

function loadSettings() {
  
  if (DEBUG) console.log('Loading settings...');
  
  if (localStorage.getItem('time24hr') !== null)
    time24hr = (localStorage.getItem('time24hr') == 'true');
  if (localStorage.getItem('lastStationId'))
    lastStationId = parseInt(localStorage.getItem('lastStationId'));
  if (localStorage.getItem('lastUpdate'))
    lastUpdate = new Date(localStorage.getItem('lastUpdate'));
  if (localStorage.getItem('lastForecastUpdate'))
    lastForecastUpdate = new Date(localStorage.getItem('lastForecastUpdate'));
  if (localStorage.getItem('lastUnits'))
    lastUnits = localStorage.getItem('lastUnits');
  
  if (localStorage.getItem('config')) {
    try {
      config = JSON.parse(localStorage.getItem('config'));
    } catch(ex) {}
  }
}

function saveSettings() {
  
  if (DEBUG) console.log('Saving settings');
  
  var refreshW = false;
  
  var saved = null;
  try {
    if (localStorage.getItem('config')) saved = JSON.parse(localStorage.getItem('config'));
  } catch(ex) {}
  localStorage.setItem('config', JSON.stringify(config));
  
  localStorage.setItem('time24Hr', time24hr);
  
  if (config.ColorScheme == 'WhiteOnBlack') {
    daymode = 0;
  } else if (config.ColorScheme == 'BlackOnWhite') {
    daymode = 1;
  }
  
  if (saved) {
    if (saved.ColorScheme !== null) {
      if (saved.ColorScheme == 'Auto' && config.ColorScheme != 'Auto') refreshW = true;
    }
    if (saved.ForecastHour !== null) {
      if (saved.ForecastHour != config.ForecastHour) refreshW = true;
    }
    if (saved.ForecastMin !== null) {
      if (saved.ForecastMin != config.ForecastMin) refreshW = true;
    }
    if (saved.WeatherLoc !== null) {
      if (saved.WeatherLoc != config.WeatherLoc) refreshW = true;
    }
    if (saved.TempUnit !== null) {
      if (saved.TempUnit != config.TempUnit) refreshW = true;
    }
  } else {
    refreshW = true;
  }
  
  if (refreshW) {
    if (DEBUG) console.log('Refreshing weather after changing settings');
    localStorage.removeItem("lastStationId");
    lastStationId = null;
    refreshWeather();
  } else {
    if (DEBUG) {
      console.log('Sending settings...');
      console.log('Update Interval: ' + config.UpdateInterval);
      console.log('First Day: ' + config.FirstDay);
      console.log('Calendar Offset: ' + config.CalOffset);
      console.log('Daymode: ' + daymode);
      console.log('Color Scheme: ' + config.ColorScheme);
      console.log('Show BT: ' + config.ShowBT);
      console.log('BT Vibes: ' + config.BTVibes);
      console.log('Show Battery: ' + config.ShowBatt);
    }
    
    // Send misc settings to the Pebble
    Pebble.sendAppMessage({
      "first_day":config.FirstDay,
      "cal_offset":config.CalOffset,
      "daymode":daymode,
      "auto_daymode":(!config.ColorScheme || config.ColorScheme === '' || config.ColorScheme == 'Auto') ? 1 : 0,
      "show_bt":config.ShowBT,
      "bt_vibes":config.BTVibes,
      "show_batt":config.ShowBatt,
      "date_format":config.DateFormat,
      "show_wind":config.ShowWind,
      "weather_fetched":0
    });
  }
    
}

// Convert/Reduce Yahoo weather codes to our weather icons
function iconFromWeatherId(weatherId) {
  switch (weatherId) {
    case '31': //clear (night)
    case '32': //sunny
    case '33': //fair (night)
    case '34': //fair (day)
      return 1; //Sunny
    case '29': //partly cloudy (night)
    case '30': //partly cloudy (day)
    case '44': //partly cloudy
      return 2; //Partly Cloudy
    case '26': //cloudy
    case '27': //mostly cloudy (night)
    case '28': //mostly cloudy (day)
      return 3; //Cloudy
    case '23': //blustery
    case '24': //windy
      return 4; //Windy
    case '19': //dust
    case '20': //foggy
    case '21': //haze
    case '22': //smoky
      return 5; //Low Visility
    case '4':  //thunderstorms
    case '37': //isolated thunderstorms
      return 6; //Isolated Thunderstorms
    case '3':  //severe thunderstorms
    case '38': //scattered thunderstorms
    case '39': //scattered thunderstorms
      return 7; //Scattered Thunderstorms
    case '9':  //drizzle
      return 8; //Drizzle
    case '11': //showers
    case '12': //showers
    case '40': //scattered showers
      return 9; //Rain
    case '8':  //freezing drizzle
    case '10': //freezing rain
    case '17': //hail
    case '35': //mixed rain and hail
      return 10; //Hail
    case '15': //blowing snow
    case '16': //snow
    case '18': //sleet
    case '41': //heavy snow
    case '43': //heavy snow
    case '46': //snow showers
      return 11; //Snow
    case '5':  //mixed rain and snow
    case '6':  //mixed rain and sleet
    case '7':  //mixed snow and sleet
      return 12; //Mixed Snow
    case '25': //cold
      return 13; //Cold
    case '0':  //tornado
      return 14; //Tornado
    case '1':  //tropical storm
      return 15; //Storm
    case '13': //snow flurries
    case '14': //light snow showers
    case '42': //scattered snow showers
      return 16; //Light Snow
    case '36': //hot
      return 17; //Hot
    case '2':  //hurricane
      return 18; //Hurricane
    case '45': //thundershowers
    case '47': //isolated thundershowers
      return 19; // Thundershowers
    default:
      return 0; // N/A
  }
}

// Add specified number of days to a Date
function addDays(date, days) {
  var result = new Date(date);
  result.setDate(date.getDate() + days);
  return result;
}

// Converts a Unix timestamp in UTC to a Javascript date in local time
function unixUTC2Local(unixTime) {
  var d = new Date(unixTime * 1000);
  //if (DEBUG) console.log('unixTime: ' + unixTime + ', UTC Date: ' + d + ', Timezone Offset: ' + d.getTimezoneOffset());
  //d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d;
}

function locationSuccess(pos) {
  // Got our Lat/Long so now fetch the weather data
  var coordinates = pos.coords;
  if (DEBUG) console.log("GPS location: " + coordinates.latitude + ", " + coordinates.longitude);
  fetchWeather("lat=" + coordinates.latitude + "&lon=" + coordinates.longitude);
}

function locationError(err) {
  console.warn('Location error (' + err.code + '): ' + err.message);
  Pebble.sendAppMessage({
    "city":"GPS N/A",
    "weather_fetched":0
  });
}

function refreshWeather() {
  
  if (config.WeatherLoc) {
    fetchWeather("q=" & encodeURIComponent(config.WeatherLoc));
  } else {
    // Trigger weather refresh by fetching location
    navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
  }
  
}

// Fetch the weather data from Yahoo and transmit to Pebble
function fetchWeather(loc) {
  
  if (DEBUG) console.log("### FETCHING WEATHER ###");
  
  var curr_time = new Date();
  
  var country, city, status, units, tempUnit, speedUnit;
  var curr_temp, sunrise, sunset;
  var curr_time, forecast_day, forecast_date, high, low, icon, condition;
  var auto_daymode, sun_rise_set, windspeed_val, windspeed, weather_time;
  
  if (config.ForecastHour !== 0 && (curr_time.getHours() > config.ForecastHour || 
                                    (curr_time.getHours() == config.ForecastHour && 
                                     curr_time.getMinutes() >= config.ForecastMin))) {
    // Between set time and Midnight, show tomorrow's forecast
    forecast_day = 'Tomorrow';
    forecast_date = addDays(new Date(), 1);
  } else {
    // At all other times, show today's forecast
    forecast_day = 'Today';
    forecast_date = new Date();
  }
  
  var reqCurrent = new XMLHttpRequest();
  var reqForecast = new XMLHttpRequest();
  
  reqCurrent.onload = function(e) {
    if (reqCurrent.readyState == 4) {
      if(reqCurrent.status == 200) {
        // Successfully retrieved current weather data
        
        // Parse weather data JSON
        var d = JSON.parse(reqCurrent.responseText);
        
        // Get weather data date
        weather_time = unixUTC2Local(d.dt);
        
        if ((Math.abs(curr_time - weather_time) / 3600000) > 3) {
          if (DEBUG) console.log('Stale weather data: ' + weather_time);
          Pebble.sendAppMessage({
            "city":"Err: Old Data", // Show error briefly
            "weather_fetched":0});
          return;
        }
        
        country = d.sys.country;
        city = d.name;
        
        if (!config.TempUnit || config.TempUnit === '' || config.TempUnit === 'Auto') {
          // Determine temperature and wind-speed units from country code 
          // (US gets F and mph, everyone else gets C and km/h)
          if (country == 'US') {
            units = 'imperial';
            tempUnit = '\u00B0' + 'F';
            speedUnit = 'mph';
          } else {
            units = 'metric';
            tempUnit = '\u00B0' + 'C';
            speedUnit = 'km/h';
          }
        } else {
          tempUnit = '\u00B0' + config.TempUnit;
          if (config.TempUnit == 'F') {
            units = 'imperial';
            speedUnit = 'mph';
          } else {
            units = 'metric';
            speedUnit = 'km/h';
          }
        }
        
        if (units !== lastUnits) {
          // If units do not match what API was called with, need to re-fetch weather data with current units
          if (DEBUG) console.log('Need to re-fetch data with new units: ' + units);
          lastUnits = units;
          localStorage.setItem('lastUnits', lastUnits);
          reqCurrent.open('GET', 'http://api.openweathermap.org/data/2.5/weather?' + loc + '&units=' + units + '&appid=' + API_KEY, true);
          reqCurrent.send(null);
          return;
        }
        
        // Get current temperature
        curr_temp = Math.round(d.main.temp).toString() + tempUnit;
        windspeed = Math.round(d.wind.speed) + speedUnit;
        
        sun_rise_set = ''; daymode = 0;
        
        if (!config.ColorScheme || config.ColorScheme === '' || config.ColorScheme == 'Auto') {
          auto_daymode = 1;
        }
        else {
          auto_daymode = 0;
          daymode = (config.ColorScheme == 'WhiteOnBlack') ? 0 : 1;
        }
        
        if (d.sys.sunrise && d.sys.sunset) {
          sunrise = unixUTC2Local(d.sys.sunrise);
          sunset = unixUTC2Local(d.sys.sunset);
          
          if (auto_daymode == 1) {
            if (!isNaN(sunrise) && !isNaN(sunset)) {
              // Calculate if the current time is between the sunrise and sunset
              // (Weather data provides the next sunrise and sunset, so we subtract 24 hours from those times
              // if they are not the same date. Technically this could be off by a minute or 2, but it will 
              // be close enough)
              if (curr_time >= addDays(sunset, (sunset.getDate() == curr_time.getDate()) ? 0 : -1 ) || 
                  curr_time < addDays(sunrise, (sunset.getDate() == curr_time.getDate()) ? 0 : -1)) {
                // Nighttime
                daymode = 0;
              } else {
                // Daytime
                daymode = 1;
              }
            }
          }
        }
        
        localStorage.setItem('lastUpdate', curr_time.toISOString());
        
        // Set the status display on the Pebble to the time of the weather update
        if (time24hr) {
          status = 'Upd: ' + curr_time.getHours() + ':' + 
            (curr_time.getMinutes() < 10 ? '0' : '') + curr_time.getMinutes();
        } else {
          status = 'Upd: ' + (((curr_time.getHours() + 11) % 12) + 1) + ':' + 
            (curr_time.getMinutes() < 10 ? '0' : '') + curr_time.getMinutes() +
            (curr_time.getHours() >= 12 ? 'PM' : 'AM');
        }
        
        if (!lastForecastUpdate || ((curr_time - lastForecastUpdate) / 3600000) >= 3) {
          // Now get the forecast data if last fetch was more than 3 hours ago  
          
          reqForecast.open('GET', 'http://api.openweathermap.org/data/2.5/forecast?' + loc + '&units=' + units + '&appid=' + API_KEY, true);
          reqForecast.send(null);
          
        } else {
          // Else just update the current data and settings
          
          if (DEBUG) {
            console.log('Only current weather data fetched...');
            console.log('Current Temp: ' + curr_temp);
            console.log('Sunrise: ' + sunrise.getHours() + ':' + sunrise.getMinutes());
            console.log('Sunrise: ' + sunset.getHours() + ':' + sunset.getMinutes());
            console.log('Daymode: ' + daymode);
            console.log('Auto Daymode: ' + auto_daymode);
            console.log('First Day: ' + config.FirstDay);
            console.log('Calendar Offset: ' + config.CalOffset);
            console.log('Show BT: ' + config.ShowBT);
            console.log('BT Vibes: ' + config.BTVibes);
            console.log('Show Battery: ' + config.ShowBatt);
            console.log('Location Changed: ' + locChanged);
            console.log('Wind Speed: ' + windspeed);
          }
          
          // Send the current weather data and settings to the Pebble
          Pebble.sendAppMessage({
              "status":status,
              "curr_temp":curr_temp,
              "daymode":daymode,
              "city":city,
              "sun_rise_hour":sunrise.getHours(),
              "sun_rise_min":sunrise.getMinutes(),
              "sun_set_hour":sunset.getHours(),
              "sun_set_min":sunset.getMinutes(),
              "auto_daymode":auto_daymode,
              "first_day":config.FirstDay,
              "cal_offset":config.CalOffset,
              "show_bt":config.ShowBT,
              "bt_vibes":config.BTVibes,
              "show_batt":config.ShowBatt,
              "loc_changed":locChanged,
              "date_format":config.DateFormat,
              "show_wind":config.ShowWind,
              "wind_speed":windspeed,
              "weather_fetched":1});
        }
        
      } else {
        console.warn("Error: " + reqCurrent.status);
        
        Pebble.sendAppMessage({
            "city":"Err: " + reqCurrent.status, // Show error briefly
            "weather_fetched":0});
      }
    }
  };
  
  
  reqForecast.onload = function(e) {
    if (reqForecast.readyState == 4) {
      if(reqForecast.status == 200) {
        // Successfully retrieved forecast weather data
        
        
        
        
        if (DEBUG) {
          console.log('Current Temp: ' + curr_temp);
          console.log('Sunrise: ' + sunrise.getHours() + ':' + sunrise.getMinutes());
          console.log('Sunrise: ' + sunset.getHours() + ':' + sunset.getMinutes());
          console.log('Forecast Day: ' + forecast_day);
          console.log('Forecast Date: ' + forecast_date);
          console.log('Low: ' + low);
          console.log('High: ' + high);
          console.log('Condition: ' + condition);
          console.log('Icon: ' + icon);
          console.log('Daymode: ' + daymode);
          console.log('Auto Daymode: ' + auto_daymode);
          console.log('Update Interval: ' + config.UpdateInterval);
          console.log('First Day: ' + config.FirstDay);
          console.log('Calendar Offset: ' + config.CalOffset);
          console.log('Show BT: ' + config.ShowBT);
          console.log('BT Vibes: ' + config.BTVibes);
          console.log('Show Battery: ' + config.ShowBatt);
          console.log('Location Changed: ' + locChanged);
          console.log('Wind Speed: ' + windspeed);
        }
        
        // Send the data to the Pebble
        Pebble.sendAppMessage({
            "status":status,
            "curr_temp":curr_temp,
            "forecast_day":forecast_day,
            "high_temp":high,
            "low_temp":low,
            "icon":icon,
            "condition":condition,
            "daymode":daymode,
            "city":city,
            "sun_rise_hour":sunrise.getHours(),
            "sun_rise_min":sunrise.getMinutes(),
            "sun_set_hour":sunset.getHours(),
            "sun_set_min":sunset.getMinutes(),
            "auto_daymode":auto_daymode,
            "update_interval":config.UpdateInterval,
            "first_day":config.FirstDay,
            "cal_offset":config.CalOffset,
            "show_bt":config.ShowBT,
            "bt_vibes":config.BTVibes,
            "show_batt":config.ShowBatt,
            "loc_changed":locChanged,
            "date_format":config.DateFormat,
            "show_wind":config.ShowWind,
            "wind_speed":windspeed,
            "weather_fetched":1});
        
      } else {
        console.warn("Error: " + reqForecast.status);
        
        Pebble.sendAppMessage({
            "city":"Err: " + reqForecast.status, // Show error briefly
            "weather_fetched":0});
      }
    }
  };
  
  // Initiate HTTP request for curent weather data
  reqCurrent.open('GET', 'http://api.openweathermap.org/data/2.5/weather?' + loc + '&units=' + lastUnits + '&appid=' + API_KEY, true);
  reqCurrent.send(null);
}

Pebble.addEventListener("ready",
                        function(e) {
                          if (DEBUG) console.log("JS Ready");
                          //localStorage.clear();
                          loadSettings();
                        });

Pebble.addEventListener("appmessage",
                        function(e) {
                          if (DEBUG) console.log("Pebble App Message!");
                          // Store 12/24hr setting passed from Pebble
                          if (e.payload !== undefined && e.payload.time_24hr !== undefined) {
                            time24hr = (e.payload.time_24hr == 1);
                            localStorage.time24hr = time24hr;
                            if (DEBUG) {
                              console.log('Payload Time 24hr: ' + e.payload.time_24hr);
                              console.log('Cfg Time 24hr: ' + time24hr);
                            }
                          }
                          
                          // Trigger location and weather fetch on command from Pebble
                          refreshWeather();
                        });

Pebble.addEventListener("showConfiguration", 
                         function() {
                           if (DEBUG) console.log("Showing Settings...");
                           Pebble.openURL(clay.generateUrl());
                          });

Pebble.addEventListener("webviewclosed",
                         function(e) {
                           if (DEBUG) console.log("Webview closed");
                           if (e.response) {
                             config = clay.getSettings(e.response);
                             if (DEBUG) console.log("Settings returned: " + JSON.stringify(config));
                             saveSettings();
                           }
                           else {
                             if (DEBUG) console.log("Settings cancelled");
                           }
                         });


