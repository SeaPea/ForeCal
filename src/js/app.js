var DEBUG = false;

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
    localStorage.removeItem("lastUpdate");
    localStorage.removeItem("lastForecastUpdate");
    localStorage.removeItem("forecastToday");
    localStorage.removeItem("forecastTomorrow");
    lastStationId = null;
    lastUpdate = null;
    lastForecastUpdate = null;
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
      console.log('Forecast time: ' + config.ForecastHour + ':' + config.ForecastMin);
      console.log('Quiet Time Start: ' + config.QTStartHour + ':' + config.QTStartMin);
      console.log('Quiet Time End: ' + config.QTEndHour + ':' + config.QTEndMin);
      console.log('Quite Time BT Vibes: ' + config.QTVibes);
      console.log('Quiet Time Fetch Weather: ' + config.QTFetch);
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
      "forecast_hour":config.ForecastHour,
      "forecast_min":config.ForecastMin,
      "qt_start_hour":config.QTStartHour,
      "qt_start_min":config.QTStartMin,
      "qt_end_hour":config.QTEndHour,
      "qt_end_min":config.QTEndMin,
      "qt_bt_vibes":config.QTVibes,
      "qt_fetch_weather":config.QTFetch,
      "weather_fetched":0
    });
  }
    
}

// Convert/Reduce OpenWeatherMap weather codes to our weather codes for icons and gives an 'exterme' priority
function codeFromWeatherId(weatherId) {
  switch (weatherId) {
    case 800: //clear
      return 1; //Sunny
    case 801: //few clouds
    case 802: //scattered clouds
    case 951: //calm
      return 2; //Partly Cloudy
    case 803: //broken clouds
    case 804: //overcast clouds
      return 3; //Cloudy
    case 903: //cold
      return 4; //Cold
    case 904: //hot
      return 5; //Hot
    case 771: //squalls
    case 905: //windy
    case 952: //light breeze
    case 953: //gentle breeze
    case 954: //moderate breeze
    case 955: //fresh breeze
    case 956: //strong breeze
    case 957: //high wind, near gale
      return 6; //Windy
    case 701: //mist 
    case 711: //smoke 
    case 721: //haze 
    case 731: //sand, dust whirls
    case 741: //fog 
    case 751: //sand 
    case 761: //dust
    case 762: //volcanic ash
      return 7; //Low Visility
    case 300: //light intensity drizzle
    case 301: //drizzle 
    case 302: //heavy intensity drizzle
    case 310: //light intensity drizzle rain
    case 311: //drizzle rain
    case 312: //heavy intensity drizzle rain
    case 313: //shower rain and drizzle
    case 314: //heavy shower rain and drizzle
    case 321: //shower drizzle
      return 8; //Drizzle
    case 500: //light rain
    case 501: //moderate rain
    case 502: //heavy intensity rain
    case 503: //very heavy rain
    case 504: //extreme rain
    case 520: //light intensity shower rain
    case 521: //shower rain
    case 522: //heavy intensity shower rain
    case 531: //ragged shower rain
      return 9; //Rain
    case 611: //sleet
    case 612: //shower sleet
    case 615: //light rain and snow
    case 616: //rain and snow
      return 10; //Mixed Snow
    case 600: //light snow
    case 620: //light shower snow
    case 621: //shower snow
      return 11; //Light Snow
    case 511: //freezing rain
    case 906: //hail
      return 12; //Hail
    case 601: //light snow
    case 602: //snow
    case 622: //heavy shower snow
      return 13; //Snow
    case 200: //thunderstorm with light rain
    case 201: //thunderstorm with rain
    case 202: //thunderstorm with heavy rain
    case 230: //thunderstorm with light drizzle
    case 231: //thunderstorm with drizzle
    case 232: //thunderstorm with heavy drizzle
      return 14; // Thundershowers
    case 210: //light thunderstorm
    case 211: //thunderstorm
      return 15; //Isolated Thunderstorms
    case 212: //heavy thunderstorm
    case 221: //ragged thunderstorm
      return 16; //Scattered Thunderstorms
    case 901: //tropical storm
    case 958: //gale
    case 959: //severe gale
    case 960: //storm
    case 961: //violent storm
      return 17; //Storm
    case 771: //tornado
    case 900: //tornado
      return 18; //Tornado
    case 902: //hurricane
    case 962: //hurricane
      return 19; //Hurricane
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
    if (DEBUG) console.log('Fetching weather using fixed location: ' + config.WeatherLoc);
    fetchWeather("q=" + encodeURIComponent(config.WeatherLoc));
  } else {
    // Trigger weather refresh by fetching location
    if (DEBUG) config.WeatherLoc('Getting GPS location for weather');
    navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
  }
  
}

// Fetch the weather data from Yahoo and transmit to Pebble
function fetchWeather(loc) {
  
  if (DEBUG) console.log("### FETCHING WEATHER ###");
  if (DEBUG) console.log('Using query string: ' + loc);
  
  var curr_time = new Date();
  
  var country, city, status, units, tempUnit, speedUnit;
  var curr_temp, sunrise, sunset;
  var forecast_day, forecast_date, high, low, icon, condition;
  var auto_daymode, windspeed, weather_time;
  var today, tomorrow, forecast;
  
  if (config.ForecastHour !== 0 && (curr_time.getHours() > config.ForecastHour || 
                                    (curr_time.getHours() == config.ForecastHour && 
                                     curr_time.getMinutes() >= config.ForecastMin))) {
    // Between set time and Midnight, show tomorrow's forecast
    forecast_day = 'Tomorrow';
    forecast_date = addDays(new Date(), 1);
    forecast = localStorage.getItem('forecastTomorrow');
  } else {
    // At all other times, show today's forecast
    forecast_day = 'Today';
    forecast_date = new Date();
    forecast = localStorage.getItem('forecastToday');
  }
  
  var reqCurrent = new XMLHttpRequest();
  var reqForecast = new XMLHttpRequest();
  
  reqCurrent.onload = function(e) {
    if (reqCurrent.readyState == 4) {
      if(reqCurrent.status == 200) {
        // Successfully retrieved current weather data
        
        var d; 
        
        try {
          // Parse weather data JSON
          d = JSON.parse(reqCurrent.responseText);
        } catch(ex) {
          Pebble.sendAppMessage({
            "city":"Err: Bad Data", // Show error briefly
            "weather_fetched":0});
          return;
        }
        
        // Validate data
        if (!d.cod) {
          Pebble.sendAppMessage({
            "city":"Err: Unknown Data", // Show error briefly
            "weather_fetched":0});
          return;
        } else if (d.cod != "200") {
          Pebble.sendAppMessage({
            "city":"OWM Err: " + d.cod, // Show error briefly
            "weather_fetched":0});
          return;
        }
        
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
            speedUnit = 'm/s';
          }
        } else {
          tempUnit = '\u00B0' + config.TempUnit;
          if (config.TempUnit == 'F') {
            units = 'imperial';
            speedUnit = 'mph';
          } else {
            units = 'metric';
            speedUnit = 'm/s';
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
        
        daymode = 0;
        
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
        
        if (!lastForecastUpdate || ((curr_time - lastForecastUpdate) / 60000) >= 175) {
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
            console.log('Forecast time: ' + config.ForecastHour + ':' + config.ForecastMin);
            console.log('Quiet Time Start: ' + config.QTStartHour + ':' + config.QTStartMin);
            console.log('Quiet Time End: ' + config.QTEndHour + ':' + config.QTEndMin);
            console.log('Quite Time BT Vibes: ' + config.QTVibes);
            console.log('Quiet Time Fetch Weather: ' + config.QTFetch);
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
              "forecast_hour":config.ForecastHour,
              "forecast_min":config.ForecastMin,
              "qt_start_hour":config.QTStartHour,
              "qt_start_min":config.QTStartMin,
              "qt_end_hour":config.QTEndHour,
              "qt_end_min":config.QTEndMin,
              "qt_bt_vibes":config.QTVibes,
              "qt_fetch_weather":config.QTFetch,
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
        
        var d; 
        
        try {
          // Parse weather data JSON
          d = JSON.parse(reqForecast.responseText);
        } catch(ex) {
          Pebble.sendAppMessage({
            "city":"Err: Bad Data", // Show error briefly
            "weather_fetched":0});
          return;
        }
        
        // Validate data
        if (!d.cod) {
          Pebble.sendAppMessage({
            "city":"Err: Unknown Data", // Show error briefly
            "weather_fetched":0});
          return;
        } else if (d.cod != "200") {
          Pebble.sendAppMessage({
            "city":"OWM Err: " + d.cod, // Show error briefly
            "weather_fetched":0});
          return;
        }
        
        localStorage.setItem('lastForecastUpdate', curr_time.toISOString());
        
        today = { high: -999, low: 999, code: -1, condition: "" };
        tomorrow = { high: -999, low: 999, code: -1, condition: "" };
        
        // Use 6am tomorrow as the end of the weather data for today (shows low for today as the next overnight low)
        var todayEnd = new Date(curr_time);
        todayEnd.setHours(29, 0, 0, 0);
        
        // Use 6am after tomorrow as the end of the weather data for tomorrow
        var tomorrowEnd = addDays(todayEnd, 1);
        var code;
        
        for (var i = 0; i < d.list.length; i++) {
          if (unixUTC2Local(d.list[i].dt) < todayEnd) {
            // Get high/low and condition for today
            if (d.list[i].main.temp_max > today.high) today.high = d.list[i].main.temp_max;
            if (d.list[i].main.temp_min < today.low) today.low = d.list[i].main.temp_min;
            for (var j = 0; j < d.list[i].weather.length; j++) {
              code = codeFromWeatherId(d.list[i].weather[j].id);
              if (code > today.code) {
                today.code = code;
                today.condition = d.list[i].weather[j].description;
              }
            }
          } else if (unixUTC2Local(d.list[i].dt) < tomorrowEnd) {
            // Get high/low and condition for today
            if (d.list[i].main.temp_max > tomorrow.high) tomorrow.high = d.list[i].main.temp_max;
            if (d.list[i].main.temp_min < tomorrow.low) tomorrow.low = d.list[i].main.temp_min;
            for (var k = 0; k < d.list[i].weather.length; k++) {
              code = codeFromWeatherId(d.list[i].weather[k].id);
              if (code > tomorrow.code) {
                tomorrow.code = code;
                tomorrow.condition = d.list[i].weather[k].description;
              }
            }
          } else {
            break;  
          }
        }
        
        localStorage.setItem("forecastToday", today);
        localStorage.setItem("forecastTomorrow", tomorrow);
        
        if (forecast_date.getDate() == curr_time.getDate())
          forecast = today;
        else
          forecast = tomorrow;
        
        high = Math.round(forecast.high) + tempUnit;
        low = Math.round(forecast.low) + tempUnit;
        icon = forecast.code;
        condition = forecast.condition;
        
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
          console.log('First Day: ' + config.FirstDay);
          console.log('Calendar Offset: ' + config.CalOffset);
          console.log('Show BT: ' + config.ShowBT);
          console.log('BT Vibes: ' + config.BTVibes);
          console.log('Show Battery: ' + config.ShowBatt);
          console.log('Location Changed: ' + locChanged);
          console.log('Wind Speed: ' + windspeed);
          console.log('Forecast time: ' + config.ForecastHour + ':' + config.ForecastMin);
          console.log('Quiet Time Start: ' + config.QTStartHour + ':' + config.QTStartMin);
          console.log('Quiet Time End: ' + config.QTEndHour + ':' + config.QTEndMin);
          console.log('Quite Time BT Vibes: ' + config.QTVibes);
          console.log('Quiet Time Fetch Weather: ' + config.QTFetch);
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
            "first_day":config.FirstDay,
            "cal_offset":config.CalOffset,
            "show_bt":config.ShowBT,
            "bt_vibes":config.BTVibes,
            "show_batt":config.ShowBatt,
            "loc_changed":locChanged,
            "date_format":config.DateFormat,
            "show_wind":config.ShowWind,
            "wind_speed":windspeed,
            "forecast_hour":config.ForecastHour,
            "forecast_min":config.ForecastMin,
            "qt_start_hour":config.QTStartHour,
            "qt_start_min":config.QTStartMin,
            "qt_end_hour":config.QTEndHour,
            "qt_end_min":config.QTEndMin,
            "qt_bt_vibes":config.QTVibes,
            "qt_fetch_weather":config.QTFetch,
            "weather_fetched":1});
        
      } else {
        console.warn("Error: " + reqForecast.status);
        
        Pebble.sendAppMessage({
            "city":"Err: " + reqForecast.status, // Show error briefly
            "weather_fetched":0});
      }
    }
  };
  
  if (lastUpdate && ((curr_time - lastUpdate) / 60000) < 55 && forecast) {
    // If less than 1 hour (use 55 minutes to account for any timestamp differences) and we have forecast data saved
    // then return the forecast data so the correct day forecast is shown at midnight and the forecast hour
    Pebble.sendAppMessage({
      "forecast_day":forecast_day,
      "high_temp":forecast.high,
      "low_temp":forecast.low,
      "icon":forecast.code,
      "condition":forecast.condition});
    
  } else {
    // Initiate HTTP request for curent weather data
    reqCurrent.open('GET', 'http://api.openweathermap.org/data/2.5/weather?' + loc + '&units=' + lastUnits + '&appid=' + API_KEY, true);
    reqCurrent.send(null);
  }
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


