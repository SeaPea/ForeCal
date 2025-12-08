const DEBUG = true;

// DO NOT REUSE THIS KEY IF FORKING OR COPYING THIS CODE SOMEWHERE ELSE.
// (This is a free tier key so it doesn't allow for many requests)
// APPLY FOR YOUR OWN KEY at OpenWeatherMap.org
var OWM_API_KEY = "106caae1620867404688360dcbd4bb3e";

var Clay = require('./clay');
var clayConfig = require('./config');
var SunCalc = require('./suncalc');
var clay = new Clay(clayConfig, null, { autoHandleEvents: false });

var daymode = 0;
var locationOptions = { "timeout": 15000, "maximumAge": 60000 };
var lastStationId = null;
var time24hr = true;
var lastUpdate = null;
var lastForecastUpdate = null;
var lastUnits = 'metric';
var geocodeCache = {}; // Cache for geocoded locations

var config = {
  ColorScheme: 'Auto',
  ShowBT: 1,
  BTVibes: 1,
  ShowBatt: 1,
  ShowWeek: 0,
  ShowSteps: 0,
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
  QTFetch: 0,
  WeatherProvider: 0,
  WeatherUpdateInterval: 60,
  RemoteEndpointUrl: '',
  RemoteEndpointToken: ''
};

// only call console.log if debug is enabled
function log_message(msg, extra) {
    if(!DEBUG) return;

    if(extra){
        console.log(`[App] ${msg}`, extra);
        return;
    }

    console.log(`[App] ${msg}`);
}

// Check if remote endpoint is configured
function isEndpointConfigured() {
  return config.RemoteEndpointUrl && config.RemoteEndpointUrl.trim() !== '';
}

// Send battery data to remote endpoint via HTTP POST with Bearer token
function sendBatteryToEndpoint(batteryPercent, isCharging) {
  if (!isEndpointConfigured()) {
    log_message('Remote endpoint not configured, skipping battery sync');
    return;
  }

  log_message('Sending battery data to remote endpoint: ' + batteryPercent + '% (charging: ' + isCharging + ')');

  var req = new XMLHttpRequest();
  req.open('POST', config.RemoteEndpointUrl, true);
  req.setRequestHeader('Content-Type', 'application/json');

  // Add Bearer token authorization if provided
  if (config.RemoteEndpointToken && config.RemoteEndpointToken.trim() !== '') {
    req.setRequestHeader('Authorization', 'Bearer ' + config.RemoteEndpointToken.trim());
  }

  req.onload = function() {
    if (req.readyState === 4) {
      if (req.status >= 200 && req.status < 300) {
        log_message('Battery data sent successfully to remote endpoint');
      } else {
        log_message('Failed to send battery data to remote endpoint. Status: ' + req.status);
      }
    }
  };

  req.onerror = function() {
    log_message('Network error sending battery data to remote endpoint');
  };

  var payload = JSON.stringify({
    battery_percent: batteryPercent,
    is_charging: isCharging,
    timestamp: new Date().toISOString()
  });

  req.send(payload);
}

function loadSettings() {

  if (DEBUG) console.log('Loading settings...');

  if (localStorage.getItem('config')) {
    try {
      config = JSON.parse(localStorage.getItem('config'));
      if (typeof config.WeatherProvider === "undefined") {
        config.WeatherProvider = 0;
        localStorage.removeItem("lastStationId");
        localStorage.removeItem("lastCity");
        localStorage.removeItem("lastUpdate");
        localStorage.removeItem("lastForecastUpdate");
        localStorage.removeItem("forecastToday");
        localStorage.removeItem("forecastTomorrow");
        lastStationId = null;
        lastUpdate = null;
        lastForecastUpdate = null;
      }
    } catch(ex) {}
  }

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

  // Load geocode cache
  if (localStorage.getItem('geocodeCache')) {
    try {
      geocodeCache = JSON.parse(localStorage.getItem('geocodeCache'));
    } catch(ex) {
      geocodeCache = {};
    }
  }
}

function saveSettings() {

  if (DEBUG) console.log('saveSettings() function called');

  var saved = null;

  // Correct data types passed back from Clay config
  config.FirstDay = parseInt(config.FirstDay);
  config.CalOffset = parseInt(config.CalOffset);
  config.DateFormat = parseInt(config.DateFormat);
  config.ForecastHour = parseInt(config.ForecastTime.split(":")[0]);
  config.ForecastMin = parseInt(config.ForecastTime.split(":")[1]);
  config.QTStartHour = parseInt(config.QTStart.split(":")[0]);
  config.QTStartMin = parseInt(config.QTStart.split(":")[1]);
  config.QTEndHour = parseInt(config.QTEnd.split(":")[0]);
  config.QTEndMin = parseInt(config.QTEnd.split(":")[1]);
  config.WeatherProvider = parseInt(config.WeatherProvider);
  config.WeatherUpdateInterval = parseInt(config.WeatherUpdateInterval) || 60;

  // Get previously saved config for comparison
  try {
    if (localStorage.getItem('config')) saved = JSON.parse(localStorage.getItem('config'));
  } catch(ex) {}
  localStorage.setItem('config', JSON.stringify(config));

  localStorage.setItem('time24Hr', time24hr);

  if (config.ColorScheme == 'WhiteOnBlack') {
    daymode = 0;
  } else if (config.ColorScheme == 'BlackOnWhite') {
    daymode = 1;
  } else {
    // Auto mode - calculate daymode immediately using SunCalc and current location
    // This prevents the display from defaulting to light mode while waiting for weather refresh
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var curr_time = new Date();
        var sunTimes = SunCalc.getTimes(curr_time, pos.coords.latitude, pos.coords.longitude);
        var sunrise = sunTimes.sunrise;
        var sunset = sunTimes.sunset;

        if (curr_time >= sunset || curr_time < sunrise) {
          daymode = 0; // Nighttime
        } else {
          daymode = 1; // Daytime
        }

        if (DEBUG) console.log('Auto daymode calculated immediately: ' + daymode);

        // Send immediate daymode update to watch
        Pebble.sendAppMessage({
          "daymode": daymode,
          "auto_daymode": 1
        }, function() {
          if (DEBUG) console.log('Immediate daymode update sent successfully: ' + (daymode ? 'true' : 'false'));
        }, function(e) {
          if (DEBUG) console.log('Failed to send immediate daymode update: ' + JSON.stringify(e));
        });
      },
      function(err) {
        if (DEBUG) console.log('Could not get location for immediate daymode calculation: ' + err.message);
      },
      { "timeout": 5000, "maximumAge": 300000 } // Allow cached location up to 5 minutes old for quick response
    );
  }

  // Always refresh weather when settings are saved
  if (DEBUG) console.log('Refreshing weather after saving settings');

  // Clear cached weather data to force fresh fetch
  localStorage.removeItem("lastStationId");
  localStorage.removeItem("lastCity");
  localStorage.removeItem("lastUpdate");
  localStorage.removeItem("lastForecastUpdate");
  localStorage.removeItem("forecastToday");
  localStorage.removeItem("forecastTomorrow");

  // Clear geocode cache if location changed
  if (saved && saved.WeatherLoc !== config.WeatherLoc) {
    if (DEBUG) console.log('Location changed, clearing geocode cache');
    geocodeCache = {};
    localStorage.removeItem("geocodeCache");
  }

  lastStationId = null;
  lastUpdate = null;
  lastForecastUpdate = null;

  refreshWeather();

  // Send endpoint configuration status to watch and request battery if configured
  var endpointIsConfigured = isEndpointConfigured();
  if (DEBUG) console.log('Remote endpoint configured: ' + endpointIsConfigured);

  Pebble.sendAppMessage({
    "endpoint_configured": endpointIsConfigured ? 1 : 0,
    "request_battery": endpointIsConfigured ? 1 : 0
  }, function() {
    if (DEBUG) console.log('Endpoint config and battery request sent to watch');
    // Reset request_battery to 0 so future requests can be detected as 0->1 transitions
    if (endpointIsConfigured) {
      Pebble.sendAppMessage({
        "request_battery": 0
      }, function() {
        if (DEBUG) console.log('Battery request reset sent to watch');
      }, function(e) {
        if (DEBUG) console.log('Failed to reset battery request: ' + JSON.stringify(e));
      });
    }
  }, function(e) {
    if (DEBUG) console.log('Failed to send endpoint config to watch: ' + JSON.stringify(e));
  });

}

// Convert/Reduce OpenWeatherMap weather codes to our weather codes for icons and gives an 'exterme' priority
function codeFromOWMId(weatherId) {
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
      return 7; //Low Visibility
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

// Convert/Reduce Yahoo weather codes to our weather codes for icons
function codeFromYiD(weatherId) {
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
    case '25': //cold
      return 4; //Cold
    case '36': //hot
      return 5; //Hot
    case '23': //blustery
    case '24': //windy
      return 6; //Windy
    case '19': //dust
    case '20': //foggy
    case '21': //haze
    case '22': //smoky
      return 7; //Low Visility
    case '9':  //drizzle
      return 8; //Drizzle
    case '11': //showers
    case '12': //showers
    case '40': //scattered showers
      return 9; //Rain
    case '5':  //mixed rain and snow
    case '6':  //mixed rain and sleet
    case '7':  //mixed snow and sleet
      return 10; //Mixed Snow
    case '13': //snow flurries
    case '14': //light snow showers
    case '42': //scattered snow showers
      return 11; //Light Snow
    case '8':  //freezing drizzle
    case '10': //freezing rain
    case '17': //hail
    case '35': //mixed rain and hail
      return 12; //Hail
    case '15': //blowing snow
    case '16': //snow
    case '18': //sleet
    case '41': //heavy snow
    case '43': //heavy snow
    case '46': //snow showers
      return 13; //Snow
    case '45': //thundershowers
    case '47': //isolated thundershowers
      return 14; // Thundershowers
    case '4':  //thunderstorms
    case '37': //isolated thunderstorms
      return 15; //Isolated Thunderstorms
    case '3':  //severe thunderstorms
    case '38': //scattered thunderstorms
    case '39': //scattered thunderstorms
      return 16; //Scattered Thunderstorms
    case '1':  //tropical storm
      return 17; //Storm
    case '0':  //tornado
      return 18; //Tornado
    case '2':  //hurricane
      return 19; //Hurricane
    default:
      return 0; // N/A
  }
}

// Convert/Reduce NWS (weather.gov) icon codes and shortForecast to our weather codes for icons
// The icon URL format is like: https://api.weather.gov/icons/land/day/sct?size=medium
// We extract the icon code from the URL path (e.g., "sct", "rain", "tsra")
function codeFromNWSIcon(iconUrl, shortForecast) {
  if (!iconUrl) return 0;

  // Extract the icon code from the URL
  // Format: https://api.weather.gov/icons/land/{day|night}/{code}?size=medium
  // or with dual icons: .../day/rain/tsra?size=medium
  var iconMatch = iconUrl.match(/\/icons\/land\/(?:day|night)\/([^?]+)/);
  if (!iconMatch) return 0;

  var iconPath = iconMatch[1];
  var iconCodes = iconPath.split('/'); // Handle dual icons like "rain/tsra"
  var primaryIcon = iconCodes[0];
  var secondaryIcon = iconCodes.length > 1 ? iconCodes[1] : null;

  // Use shortForecast as additional context
  var forecast = (shortForecast || '').toLowerCase();

  // Priority order: severe weather → thunderstorms → snow → ice/hail → rain → fog → wind → temp → clouds

  // Severe weather (19, 18, 17)
  if (primaryIcon === 'hurricane' || primaryIcon.includes('hurricane') || forecast.includes('hurricane')) {
    return 19; // Hurricane
  }
  if (primaryIcon === 'tornado' || primaryIcon.includes('tornado') || forecast.includes('tornado')) {
    return 18; // Tornado
  }
  if (primaryIcon === 'tropical_storm' || primaryIcon.includes('tropical') || forecast.includes('tropical storm')) {
    return 17; // Storm/Tropical Storm
  }

  // Thunderstorms (16, 15, 14)
  if (primaryIcon === 'tsra' || primaryIcon === 'tsra_sct' || primaryIcon === 'tsra_hi' ||
      primaryIcon.includes('tsra') || secondaryIcon === 'tsra' || forecast.includes('thunderstorm')) {
    // tsra_sct = scattered thunderstorms, tsra_hi = isolated/slight chance
    if (primaryIcon === 'tsra_sct' || forecast.includes('scattered')) {
      return 16; // Scattered Thunderstorms
    } else if (primaryIcon === 'tsra_hi' || forecast.includes('isolated') || forecast.includes('slight chance')) {
      return 15; // Isolated Thunderstorms
    } else {
      return 14; // Thundershowers
    }
  }

  // Blizzard (13) - severe snow condition
  if (primaryIcon === 'blizzard' || forecast.includes('blizzard')) {
    return 13; // Snow (blizzard is severe snow)
  }

  // Snow conditions (13, 11, 10)
  if (primaryIcon === 'snow' || primaryIcon === 'snow_showers' || primaryIcon.includes('snow') ||
      forecast.includes('snow')) {
    // Check for mixed conditions first
    if (primaryIcon === 'rain_snow' || primaryIcon === 'snow_sleet' || primaryIcon === 'rain_sleet' ||
        primaryIcon.includes('rain_snow') || primaryIcon.includes('snow_sleet') ||
        forecast.includes('rain and snow') || forecast.includes('wintry mix') || forecast.includes('rain snow')) {
      return 10; // Mixed Snow
    }
    // Check for light snow or snow showers
    if (primaryIcon === 'snow_showers' || forecast.includes('light snow') ||
        forecast.includes('flurries') || forecast.includes('snow showers')) {
      return 11; // Light Snow
    }
    // Heavy or regular snow (including blowing snow)
    if (forecast.includes('blowing snow') || forecast.includes('heavy snow')) {
      return 13; // Snow
    }
    return 13; // Snow (default for snow)
  }

  // Freezing rain / Ice / Hail / Sleet (12)
  if (primaryIcon === 'fzra' || primaryIcon === 'sleet' || primaryIcon === 'ice_pellets' ||
      primaryIcon.includes('fzra') || primaryIcon.includes('sleet') ||
      primaryIcon.includes('ice_pellets') || primaryIcon.includes('hail') ||
      forecast.includes('freezing') || forecast.includes('sleet') ||
      forecast.includes('ice pellets') || forecast.includes('hail')) {
    return 12; // Hail/Ice
  }

  // Rain conditions (9, 8)
  if (primaryIcon === 'rain' || primaryIcon === 'rain_showers' ||
      primaryIcon.includes('rain') || primaryIcon.includes('showers') ||
      forecast.includes('rain') || forecast.includes('showers')) {
    // Check for drizzle
    if (forecast.includes('drizzle')) {
      return 8; // Drizzle
    }
    return 9; // Rain
  }

  // Fog / Low visibility (7)
  if (primaryIcon === 'fog' || primaryIcon === 'dust' || primaryIcon === 'smoke' || primaryIcon === 'haze' ||
      primaryIcon.includes('fog') || primaryIcon.includes('dust') ||
      primaryIcon.includes('smoke') || forecast.includes('fog') ||
      forecast.includes('haze') || forecast.includes('smoke') ||
      forecast.includes('dust')) {
    return 7; // Low Visibility
  }

  // Wind (6) - includes wind_skc, wind_few, wind_sct, wind_bkn, wind_ovc
  if (primaryIcon.startsWith('wind_') || primaryIcon.includes('wind') ||
      forecast.includes('windy') || forecast.includes('breezy') || forecast.includes('blustery')) {
    return 6; // Windy
  }

  // Temperature extremes (5, 4)
  if (primaryIcon === 'hot' || forecast.includes('hot')) {
    return 5; // Hot
  }
  if (primaryIcon === 'cold' || forecast.includes('cold')) {
    return 4; // Cold
  }

  // Cloud cover (3, 2, 1) - use icon codes
  // skc = sky clear, few = few clouds (0-25%), sct = scattered (25-50%), bkn = broken (50-75%), ovc = overcast (75-100%)
  if (primaryIcon === 'skc' || primaryIcon === 'few' ||
      forecast.includes('clear') || forecast.includes('sunny') || forecast.includes('mostly clear')) {
    return 1; // Sunny/Clear
  }
  if (primaryIcon === 'sct' ||
      forecast.includes('partly cloudy') || forecast.includes('mostly sunny') ||
      forecast.includes('partly sunny')) {
    return 2; // Partly Cloudy
  }
  if (primaryIcon === 'bkn' || primaryIcon === 'ovc' ||
      forecast.includes('mostly cloudy') || forecast.includes('cloudy') ||
      forecast.includes('overcast')) {
    return 3; // Cloudy
  }

  // Default
  return 0; // N/A
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

// Converts a time string (e.g. "7:31 am") to a Javascript date in local time with today's date
function timeStrToDate(timeAsStr) {
  var d = new Date();
  if (timeAsStr) {
    var parts = timeAsStr.match(/(\d{1,2}):(\d{1,2})\s*([ap])/i);
    if (parts) {
      d.setHours(parseInt(parts[1]) + (parts[3].toLowerCase() == 'p' ? 12 : 0));
      d.setMinutes(parseInt(parts[2]));
      d.setSeconds(0);
      return d;
    } else
      return NaN;
  } else
    return NaN;
}

// Gets a time string from a JS date object
function timeStr(time) {
  if (time24hr) {
    return time.getHours() + ':' +
      (time.getMinutes() < 10 ? '0' : '') + time.getMinutes();
  } else {
    return (((time.getHours() + 11) % 12) + 1) + ':' +
      (time.getMinutes() < 10 ? '0' : '') + time.getMinutes() +
      (time.getHours() >= 12 ? 'PM' : 'AM');
  }
}

function t24HTo12(hours) {
  if ((hours) > 12)
    return hours-12;
  else
    return hours;
}

function pad24Hour(hours) {
  if (hours.toString().length < 2)
    return '0' + hours;
  else
    return hours;
}

// Converts 24 hour start and end times to a range in 12 or 24 hour text format based on the watch 12/24hour setting
function timeRange2Text(startHour, endHour) {
  if (time24hr) {
    return pad24Hour(startHour) + '-' + pad24Hour(endHour) + 'h';
  } else {
    if (startHour < 12 && endHour < 12) {
      return startHour + '-' + endHour + 'am';
    } else if (startHour >= 12 && endHour >= 12) {
      return t24HTo12(startHour) + '-' + t24HTo12(endHour) + 'pm';
    } else {
      return (startHour < 12 ? startHour + 'am' : t24HTo12(startHour) + 'pm') + '-' +
        (endHour < 12 ? endHour + 'am' : t24HTo12(endHour) + 'pm');
    }
  }
}

// Converts an array of times from the 3 hour forecast into the shortest text string
// showing when the condition applies
function conditionTimes2Text(times) {
  var text = '';
  var ranges = [];

  // Start with 1st 3 hour time range
  if (times.length >= 1) ranges = [{startHour: times[0], endHour: (times[0]+3)%24}];

  // Consolidate sequential time ranges
  for (var i = 1; i < times.length; i++) {
    if (ranges[ranges.length-1].endHour == times[i])
      // Extend last range for continuous time range
      ranges[ranges.length-1].endHour = (ranges[ranges.length-1].endHour+3)%24;
    else
      // Add new range for disjointed time range
      ranges.push({startHour: times[i], endHour: (times[i]+3)%24});
  }

  // Convert time ranges to text
  for (var j = 0; j < ranges.length; j++) {
    if (text) text += ',';
    text += timeRange2Text(ranges[j].startHour, ranges[j].endHour);
  }

  return (text ? ' ' + text : '');
}

// Formats temperature (provided in kelvin) in the last units specified in the settings
// (if kelvin value is < 150, it assumes we were given the final temp unit instead)
function formatTempK(kelvin) {
  try {
    if (lastUnits == 'metric')
      return Math.round(kelvin < 150 ? kelvin : kelvin - 273.15) + '\u00B0' + 'C';
    else if (lastUnits == 'imperial')
      return Math.round(kelvin < 150 ? kelvin : (((kelvin * 9) / 5) - 459.67)) + '\u00B0' + 'F';
    else
      return 'N/A';
  } catch(ex) {
    console.error('formatTempK(' + kelvin + ') Error: ' + ex);
    return 'ERR';
  }
}

// Formats temperature (provided in fahrenheit) in the last units specified in the settings
function formatTempF(f) {
  try {
    if (f) {
      if (lastUnits == 'metric')
        return Math.round((f - 32) * 5 / 9.0) + '\u00B0' + 'C';
      else if (lastUnits == 'imperial')
        return Math.round(f) + '\u00B0' + 'F';
      else
        return 'N/A';
    } else
      return "";
  } catch (ex) {
    console.error('formatTempF(' + f + ') Error: ' + ex);
    return 'ERR';
  }
}

// Formats speed (provided in metres per second) in the last units specified in the settings
function formatSpeedms(ms) {
  try {
    if (lastUnits == 'metric')
      return Math.round(ms) + 'm/s';
    else if (lastUnits == 'imperial')
      return Math.round(ms * 2.236) + 'mph';
    else
      return 'n/a';
  } catch(ex) {
    console.error('formatSpeedms(' + ms + ') Error: ' + ex);
    return 'err';
  }
}

// Formats speed (provided in miles per hour) in the last units specified in the settings
function formatSpeedmph(mph) {
  try {
    if (lastUnits == 'metric')
      return Math.round(mph / 2.236) + 'm/s';
    else if (lastUnits == 'imperial')
      return Math.round(mph) + 'mph';
    else
      return 'n/a';
  } catch(ex) {
    console.error('formatSpeedmph(' + mph + ') Error: ' + ex);
    return 'err';
  }
}

function locationSuccess(pos) {
  // Got our Lat/Long so now fetch the weather data
  var coordinates = pos.coords;
  log_message("GPS location: " + coordinates.latitude + ", " + coordinates.longitude);

  if (config.PreferNWS) {
    log_message('NWS preference enabled - attempting NWS with GPS coordinates');
    // Try NWS first, with fallback to selected provider on error
    fetchNWSWeatherWithFallback(coordinates.latitude, coordinates.longitude);
  } else {
    // Use selected provider normally
    log_message('Using selected weather provider (NWS preference disabled)');
    if (typeof config.WeatherProvider !== "undefined" && config.WeatherProvider == 1) {
      fetchOWMWeather("lat=" + coordinates.latitude + "&lon=" + coordinates.longitude);
    } else {
      fetchYWeather("(" + coordinates.latitude + "," + coordinates.longitude + ")");
    }
  }
}

function locationError(err) {
  console.warn('Location error (' + err.code + '): ' + err.message);
  Pebble.sendAppMessage({
    "city":"GPS N/A",
    "weather_fetched":0
  });
}


// Fetch NWS weather with automatic fallback to selected provider if NWS fails
function fetchNWSWeatherWithFallback(lat, lon) {
  log_message('Attempting NWS weather fetch with fallback capability');

  // First, try to get the grid point information from NWS
  var reqPoints = new XMLHttpRequest();
  var pointsUrl = 'https://api.weather.gov/points/' + lat.toFixed(4) + ',' + lon.toFixed(4);

  reqPoints.open('GET', pointsUrl, true);
  reqPoints.setRequestHeader('User-Agent', 'PebbleForeCal/1.0');

  reqPoints.onload = function() {
    if (reqPoints.readyState === 4) {
      if (reqPoints.status === 200) {
        // NWS is available for this location - proceed with full NWS fetch
        log_message('NWS points endpoint successful - location is within NWS coverage');
        fetchNWSWeather(lat, lon);
      } else {
        // NWS not available (likely outside USA coverage) - fall back to selected provider
        log_message('NWS points endpoint failed (status: ' + reqPoints.status + ') - falling back to selected provider');
        fallbackToSelectedProvider(lat, lon);
      }
    }
  };

  reqPoints.onerror = function() {
    // Network error or NWS unavailable - fall back to selected provider
    log_message('NWS points endpoint network error - falling back to selected provider');
    fallbackToSelectedProvider(lat, lon);
  };

  reqPoints.send(null);
}

// Helper function to fall back to the selected weather provider
function fallbackToSelectedProvider(lat, lon) {
  log_message('Falling back to selected provider with coordinates: ' + lat + ', ' + lon);

  if (typeof config.WeatherProvider !== "undefined" && config.WeatherProvider == 1) {
    log_message('Using OpenWeatherMap as fallback');
    fetchOWMWeather("lat=" + lat + "&lon=" + lon);
  } else {
    log_message('Using Yahoo as fallback');
    fetchYWeather("(" + lat + "," + lon + ")");
  }
}

// Geocode a location string to lat/lon using OpenStreetMap Nominatim
// Success callback receives: (lat, lon, country_code)
function geocodeLocation(location, successCallback, errorCallback) {
  log_message('Geocoding location: ' + location);

  // Check cache first
  if (geocodeCache[location]) {
    log_message('Using cached geocode result for: ' + location);
    successCallback(geocodeCache[location].lat, geocodeCache[location].lon, geocodeCache[location].country_code);
    return;
  }

  var url = 'https://nominatim.openstreetmap.org/search?q=' +
            encodeURIComponent(location) +
            '&format=json&limit=1&addressdetails=1';

  var req = new XMLHttpRequest();

  req.open('GET', url, true);
  req.setRequestHeader('User-Agent', 'PebbleForeCal/1.0');

  req.onload = function() {
    if (req.readyState === 4) {
      if (req.status === 200) {
        try {
          var response = JSON.parse(req.responseText);

          if (response && response.length > 0) {
            var lat = parseFloat(response[0].lat);
            var lon = parseFloat(response[0].lon);
            var country_code = '';

            // Extract country code from address details
            if (response[0].address && response[0].address.country_code) {
              country_code = response[0].address.country_code.toLowerCase();
            }

            log_message('Geocoded "' + location + '" to: ' + lat + ', ' + lon + ' (country: ' + country_code + ')');

            // Cache the result with country code
            geocodeCache[location] = { lat: lat, lon: lon, country_code: country_code };
            localStorage.setItem('geocodeCache', JSON.stringify(geocodeCache));

            successCallback(lat, lon, country_code);
          } else {
            log_message('No geocoding results found for: ' + location);
            errorCallback('Location not found');
          }
        } catch(e) {
          log_message('Error parsing geocode response: ' + e.message);
          errorCallback('Geocoding error');
        }
      } else {
        log_message('Geocoding request failed with status: ' + req.status);
        errorCallback('Geocoding service error');
      }
    }
  };

  req.onerror = function() {
    log_message('Geocoding request error');
    errorCallback('Network error');
  };

  req.send(null);
}


function refreshWeather() {

  if (config.WeatherLoc) {
    // Manual location entry
    log_message('Fetching weather using fixed location: ' + config.WeatherLoc);

    // Check if NWS preference is enabled
    if (config.PreferNWS) {
      log_message('NWS preference enabled - geocoding location to check country');

      // Geocode the location to get coordinates and country code
      geocodeLocation(
        config.WeatherLoc,
        function(lat, lon, country_code) {
          // Success - check if location is in USA
          if (country_code === 'us') {
            log_message('Location is in USA - using NWS');
            fetchNWSWeather(lat, lon);
          } else {
            log_message('Location is outside USA (country: ' + country_code + ') - falling back to selected provider');
            // Fall back to selected provider using geocoded coordinates
            if (typeof config.WeatherProvider !== "undefined" && config.WeatherProvider == 1) {
              fetchOWMWeather("lat=" + lat + "&lon=" + lon);
            } else {
              fetchYWeather("(" + lat + "," + lon + ")");
            }
          }
        },
        function(error) {
          // Geocoding failed - show error message
          log_message('Geocoding failed: ' + error);
          Pebble.sendAppMessage({
            "city":"Geocode Error",
            "weather_fetched":0
          });
        }
      );
    } else {
      // NWS preference disabled - use selected provider normally
      log_message('Using selected weather provider (NWS preference disabled)');
      if (typeof config.WeatherProvider !== "undefined" && config.WeatherProvider == 1) {
        fetchOWMWeather("q=" + encodeURIComponent(config.WeatherLoc));
      } else {
        fetchYWeather(encodeURIComponent(config.WeatherLoc));
      }
    }
  } else {
    // GPS location
    log_message('Getting GPS location for weather');
    navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
  }

}

function fetchYWeather(loc) {

  if (DEBUG) console.log("### FETCHING YAHOO WEATHER ###");
  if (DEBUG) console.log('Using query string: ' + loc);

  var curr_time = new Date();

  var country, region, city, status, units;
  var curr_temp, sunrise, sunset;
  var forecast_day, forecast_date;
  var auto_daymode, windspeed;
  var today, tomorrow, forecast;
  var stationId, locChanged;

  if (config.ForecastHour !== 0 && (curr_time.getHours() > config.ForecastHour ||
                                    (curr_time.getHours() == config.ForecastHour &&
                                     curr_time.getMinutes() >= config.ForecastMin))) {
    // Between set time and Midnight, show tomorrow's forecast
    forecast_day = 'Tomorrow';
    forecast_date = addDays(new Date(), 1);
    forecast = JSON.parse(localStorage.getItem('forecastTomorrow'));
  } else {
    // At all other times, show today's forecast
    forecast_day = 'Today';
    forecast_date = new Date();
    if (lastUpdate && lastUpdate.getDate() != curr_time.getDate())
      // If last update and current time are different days, we just crossed over midnight so show tomorrow forecast, but call it 'today'
      // to save all users trying to update at midnight and causing requests to hit limit
      forecast = JSON.parse(localStorage.getItem('forecastTomorrow'));
    else
      forecast = JSON.parse(localStorage.getItem('forecastToday'));
  }

  var reqWeather = new XMLHttpRequest();

  reqWeather.onload = function(e) {
    if (reqWeather.readyState == 4) {
      if (reqWeather.status == 200) {
        // Successfully retrieved weather data

        var d, d2;

        try {
          // Parse weather data JSON
          d2 = JSON.parse(reqWeather.responseText);
        } catch(ex) {
          Pebble.sendAppMessage({
            "city":"Err: Bad Data", // Show error briefly
            "weather_fetched":0});
          return;
        }

        // Validate data
        if (d2.error && d.error.description) {
          console.warn("Yahoo Weather Error: " + d.error.description);
          Pebble.sendAppMessage({
            "city":"Y Err: " + (d.error.description.length > 8 ? d.error.description.substr(0, 8) : d.error.description), // Show error briefly
            "weather_fetched":0});
          return;
        } else if (!d2.query) {
          Pebble.sendAppMessage({
            "city":"Err: Unknown Data", // Show error briefly
            "weather_fetched":0});
          return;
        } else if (!d2.query.results) {
          Pebble.sendAppMessage({
            "city":"Loc. Not Found", // Show error briefly
            "weather_fetched":0});
          return;
        }

        d = d2.query.results.channel;

        country = d[0].location.country;
        region = d[0].location.region;
        city = d[0].location.city;

        if (!config.TempUnit || config.TempUnit === '' || config.TempUnit === 'Auto') {
          // Determine temperature and wind-speed units from country code
          // (US gets F and mph, everyone else gets C and m/s)
          if (country == 'United States')
            units = 'imperial';
          else
            units = 'metric';
        } else {
          if (config.TempUnit == 'F')
            units = 'imperial';
          else
            units = 'metric';
        }

        lastUnits = units;
        localStorage.setItem('lastUnits', lastUnits);

        stationId = region + city;
        locChanged = (stationId == lastStationId ? 0 : 1);
        lastStationId = stationId;
        localStorage.setItem("lastStationId", stationId);
        localStorage.setItem("lastCity", city);

        // Get current condtion
        curr_temp = d[0].item.condition.temp;
        windspeed = d[0].wind.speed;

        daymode = 0;

        if (!config.ColorScheme || config.ColorScheme === '' || config.ColorScheme == 'Auto') {
          auto_daymode = 1;
        }
        else {
          auto_daymode = 0;
          daymode = (config.ColorScheme == 'WhiteOnBlack') ? 0 : 1;
        }

        if (d[0].astronomy) {
          sunrise = timeStrToDate(d[0].astronomy.sunrise);
          sunset = timeStrToDate(d[0].astronomy.sunset);

          if (auto_daymode == 1) {
            if (!isNaN(sunrise) && !isNaN(sunset)) {
              // Calculate if the current time is between the sunrise and sunset
              if (curr_time >= sunset || curr_time < sunrise) {
                // Nighttime
                daymode = 0;
              } else {
                // Daytime
                daymode = 1;
              }
            }
          }
        }

        // Set the status display on the Pebble to the time of the weather update
        status = 'Upd: ' + timeStr(curr_time);

        localStorage.setItem('lastForecastUpdate', curr_time.toISOString());

        today = { high: d[0].item.forecast.high, low: d[0].item.forecast.low, code: codeFromYiD(d[0].item.forecast.code), condition: d[0].item.forecast.text };
        tomorrow = { high: d[1].item.forecast.high, low: d[1].item.forecast.low, code: codeFromYiD(d[1].item.forecast.code), condition: d[1].item.forecast.text };

        lastUpdate = new Date(curr_time);
        localStorage.setItem('lastUpdate', curr_time.toISOString());
        localStorage.setItem("forecastToday", JSON.stringify(today));
        localStorage.setItem("forecastTomorrow", JSON.stringify(tomorrow));

        if (forecast_date.getDate() == curr_time.getDate())
          forecast = today;
        else
          forecast = tomorrow;

        if (DEBUG) {
          console.log('Current Temp: ' + formatTempF(curr_temp));
          console.log('Sunrise: ' + sunrise.getHours() + ':' + sunrise.getMinutes());
          console.log('Sunrise: ' + sunset.getHours() + ':' + sunset.getMinutes());
          console.log('Forecast Day: ' + forecast_day);
          console.log('Forecast Date: ' + forecast_date);
          console.log('Low: ' + formatTempF(forecast.low));
          console.log('High: ' + formatTempF(forecast.high));
          console.log('Condition: ' + forecast.condition);
          console.log('Icon: ' + forecast.code);
          console.log('Daymode: ' + daymode);
          console.log('Auto Daymode: ' + auto_daymode);
          console.log('First Day: ' + config.FirstDay);
          console.log('Calendar Offset: ' + config.CalOffset);
          console.log('Show BT: ' + config.ShowBT);
          console.log('BT Vibes: ' + config.BTVibes);
          console.log('Show Battery: ' + config.ShowBatt);
          console.log('Show Week: ' + config.ShowWeek);
          console.log('Show Steps: ' + config.ShowSteps);
          console.log('Location Changed: ' + locChanged);
          console.log('Wind Speed: ' + formatSpeedmph(windspeed));
          console.log('Forecast time: ' + config.ForecastHour + ':' + config.ForecastMin);
          console.log('Quiet Time Start: ' + config.QTStartHour + ':' + config.QTStartMin);
          console.log('Quiet Time End: ' + config.QTEndHour + ':' + config.QTEndMin);
          console.log('Quite Time BT Vibes: ' + config.QTVibes);
          console.log('Quiet Time Fetch Weather: ' + config.QTFetch);
        }

        // Send the data to the Pebble
        Pebble.sendAppMessage({
            "status":status,
            "curr_temp":formatTempF(curr_temp),
            "forecast_day":forecast_day,
            "high_temp":formatTempF(forecast.high),
            "low_temp":formatTempF(forecast.low),
            "icon":forecast.code,
            "condition":forecast.condition,
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
            "show_week":config.ShowWeek,
            "show_steps":config.ShowSteps,
            "loc_changed":locChanged,
            "date_format":config.DateFormat,
            "show_wind":config.ShowWind,
            "wind_speed":formatSpeedmph(windspeed),
            "forecast_hour":config.ForecastHour,
            "forecast_min":config.ForecastMin,
            "qt_start_hour":config.QTStartHour,
            "qt_start_min":config.QTStartMin,
            "qt_end_hour":config.QTEndHour,
            "qt_end_min":config.QTEndMin,
            "qt_bt_vibes":config.QTVibes,
            "qt_fetch_weather":config.QTFetch,
            "weather_update_interval":config.WeatherUpdateInterval,
            "weather_fetched":1});

      } else {
        console.warn("Yahoo HTTP Error: " + reqWeather.status);

        Pebble.sendAppMessage({
          "city":"HTTP Err: " + reqWeather.status, // Show error briefly
          "weather_fetched":0});
      }
    }
  };

  if (DEBUG) {
    console.log('Last update: ' + lastUpdate);
    console.log('Forecast data: ' + JSON.stringify(forecast));
    console.log('Mins since last update: ' + ((curr_time - lastUpdate) / 60000));
  }

  // Always fetch fresh weather data when requested
  // Initiate HTTP request for curent weather data from YAHOO!
  reqWeather.open('GET', "https://query.yahooapis.com/v1/public/yql?q=select%20location,%20wind,%20astronomy,%20item.condition,item.forecast%20from%20weather.forecast%20where%20woeid%20IN%20(select%20locality1.woeid%20from%20geo.places(0,1)%20where%20text%3D%27" + loc.replace("'", "%27%27") + "%27)%20and%20u%3D%27f%27%20%7C%20truncate(count%3D2)&format=json", true);
  reqWeather.send(null);
}

// Fetch the weather data from the OpenWeatherMap web service and transmit to Pebble
function fetchOWMWeather(loc) {

  if (DEBUG) console.log("### FETCHING OWM WEATHER ###");
  if (DEBUG) console.log('Using query string: ' + loc);

  var curr_time = new Date();

  var country, city, status, units;
  var curr_temp, sunrise, sunset, locChanged = 0, stationId = 0;
  var forecast_day, forecast_date, high, low, icon, condition;
  var auto_daymode, windspeed, weather_time;
  var today, tomorrow, forecast;

  if (config.ForecastHour !== 0 && (curr_time.getHours() > config.ForecastHour ||
                                    (curr_time.getHours() == config.ForecastHour &&
                                     curr_time.getMinutes() >= config.ForecastMin))) {
    // Between set time and Midnight, show tomorrow's forecast
    forecast_day = 'Tomorrow';
    forecast_date = addDays(new Date(), 1);
    forecast = JSON.parse(localStorage.getItem('forecastTomorrow'));
  } else {
    // At all other times, show today's forecast
    forecast_day = 'Today';
    forecast_date = new Date();
    if (lastUpdate && lastUpdate.getDate() != curr_time.getDate())
      // If last update and current time are different days, we just crossed over midnight so show tomorrow forecast, but call it 'today'
      // to save all users trying to update at midnight and causing requests to hit limit
      forecast = JSON.parse(localStorage.getItem('forecastTomorrow'));
    else
      forecast = JSON.parse(localStorage.getItem('forecastToday'));
  }

  // Setup HTTP requests for current weather data and forecast data
  var reqCurrent = new XMLHttpRequest();
  var reqForecast = new XMLHttpRequest();

  // First HTTP is triggered at the end of this function...

  reqCurrent.onload = function(e) {
    if (reqCurrent.readyState == 4) {
      if (reqCurrent.status == 200) {
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
        } else if (d.cod == "404") {
          Pebble.sendAppMessage({
            "city":"Loc. Not Found", // Show error briefly
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
          // (US gets F and mph, everyone else gets C and m/s)
          if (country == 'US')
            units = 'imperial';
          else
            units = 'metric';
        } else {
          if (config.TempUnit == 'F')
            units = 'imperial';
          else
            units = 'metric';
        }

        lastUnits = units;
        localStorage.setItem('lastUnits', lastUnits);

        stationId = d.id;
        locChanged = (stationId == lastStationId ? 0 : 1);
        lastStationId = stationId;
        localStorage.setItem("lastStationId", stationId);
        localStorage.setItem("lastCity", city);

        // Get current condtion
        curr_temp = d.main.temp;
        windspeed = d.wind.speed;

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

        // Set the status display on the Pebble to the time of the weather update
        status = 'Upd: ' + timeStr(curr_time);

        if (locChanged == 1 || !lastForecastUpdate || ((curr_time - lastForecastUpdate) / 60000) >= 175) {
          // Now get the forecast data if last fetch was more than 3 hours ago or the station has changed

          reqForecast.open('GET', 'http://api.openweathermap.org/data/2.5/forecast?id=' + stationId + '&appid=' + OWM_API_KEY, true);
          reqForecast.send(null);

        } else {
          // Else just update the current data and settings

          if (DEBUG) {
            console.log('Only current weather data fetched...');
            console.log('Current Temp: ' + formatTempK(curr_temp));
            console.log('Sunrise: ' + sunrise.getHours() + ':' + sunrise.getMinutes());
            console.log('Sunrise: ' + sunset.getHours() + ':' + sunset.getMinutes());
            console.log('Daymode: ' + daymode);
            console.log('Auto Daymode: ' + auto_daymode);
            console.log('First Day: ' + config.FirstDay);
            console.log('Calendar Offset: ' + config.CalOffset);
            console.log('Show BT: ' + config.ShowBT);
            console.log('BT Vibes: ' + config.BTVibes);
            console.log('Show Battery: ' + config.ShowBatt);
            console.log('Show Week: ' + config.ShowWeek);
            console.log('Show Steps: ' + config.ShowSteps);
            console.log('Location Changed: ' + locChanged);
            console.log('Wind Speed: ' + formatSpeedms(windspeed));
            console.log('Forecast time: ' + config.ForecastHour + ':' + config.ForecastMin);
            console.log('Quiet Time Start: ' + config.QTStartHour + ':' + config.QTStartMin);
            console.log('Quiet Time End: ' + config.QTEndHour + ':' + config.QTEndMin);
            console.log('Quite Time BT Vibes: ' + config.QTVibes);
            console.log('Quiet Time Fetch Weather: ' + config.QTFetch);
          }

          // Send the current weather data and settings to the Pebble
          Pebble.sendAppMessage({
              "status":status,
              "curr_temp":formatTempK(curr_temp),
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
              "show_week":config.ShowWeek,
              "show_steps":config.ShowSteps,
              "loc_changed":locChanged,
              "date_format":config.DateFormat,
              "show_wind":config.ShowWind,
              "wind_speed":formatSpeedms(windspeed),
              "forecast_hour":config.ForecastHour,
              "forecast_min":config.ForecastMin,
              "qt_start_hour":config.QTStartHour,
              "qt_start_min":config.QTStartMin,
              "qt_end_hour":config.QTEndHour,
              "qt_end_min":config.QTEndMin,
              "qt_bt_vibes":config.QTVibes,
              "qt_fetch_weather":config.QTFetch,
              "weather_update_interval":config.WeatherUpdateInterval,
              "forecast_day":forecast_day,
              "high_temp":(forecast.high == -999 ? "" : formatTempK(forecast.high)),
              "low_temp":(forecast.low == 999 ? "" : formatTempK(forecast.low)),
              "icon":(forecast.low == -1 ? 0 : forecast.code),
              "condition":forecast.condition,
              "weather_fetched":1});
        }

      } else {
        console.warn("Error: " + reqCurrent.status);

        if (reqCurrent.status == 429) {
          // Server thinks we have made too many requests too quickly
          Pebble.sendAppMessage({
              "city":"Try later", // Show error briefly
              "weather_fetched":0});
        } else {
          Pebble.sendAppMessage({
              "city":"Err: " + reqCurrent.status, // Show error briefly
              "weather_fetched":0});
        }
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

        // Use 6am tomorrow as the end of the high/low weather data for today (shows low for today as the next overnight low)
        var todayEnd = new Date(curr_time);
        todayEnd.setHours(30, 0, 0, 0);
        // Use 6pm today as the end of the condition weather data for today if more than 12 hours away
        var todayEndCondition = new Date(curr_time);
        todayEndCondition.setHours(18, 0, 0, 0);

        // Use 6am after tomorrow as the end of the high/low weather data for tomorrow
        var tomorrowEnd = addDays(todayEnd, 1);
        // Use 6pm tomorrow as the end of the condition weather data for tomorrow
        var tomorrowEndCondition = addDays(todayEndCondition, 1);

        if (DEBUG) {
          console.log('Today End: ' + todayEnd);
          console.log('Today End Condition: ' + todayEndCondition);
          console.log('Tomorrow End: ' + tomorrowEnd);
          console.log('Tomorrow End Condition: ' + tomorrowEndCondition);
        }

        var code, forecastTime;
        var today_cond_times = [];
        var tmrrw_cond_times = [];

        for (var i = 0; i < d.list.length; i++) {
          forecastTime = unixUTC2Local(d.list[i].dt);
          if (forecastTime < todayEnd) {
            // Get high/low for today
            if (today.high == -999) today.high = curr_temp;
            if (today.low == 999) today.low = curr_temp;
            if (DEBUG) console.log("Today Forecast: " + forecastTime + ", High: " + formatTempK(d.list[i].main.temp_max) + ", Low: " + formatTempK(d.list[i].main.temp_min));

            if (d.list[i].main.temp_max > today.high) today.high = d.list[i].main.temp_max;

            if (d.list[i].main.temp_min < today.low) today.low = d.list[i].main.temp_min;

            if (forecastTime <= todayEndCondition || ((forecastTime - curr_time) / 3600000) <= 12 ) {
              // If earlier than 6pm today or less than 12 hours in future get 'worst' weather condition for today
              // where 'worst' is defined by the order of the condition codes (higher = worse)
              for (var j = 0; j < d.list[i].weather.length; j++) {
                if (DEBUG) console.log("Today Forecast: " + forecastTime + ", Condition: " + d.list[i].weather[j].id + " - " + d.list[i].weather[j].description);
                code = codeFromOWMId(d.list[i].weather[j].id);
                if (code > today.code) {
                  today.code = code;
                  today.condition = d.list[i].weather[j].description;
                  // If condition is drizzle or worse (rain, storms, etc) and is worst so far, save first time for adding to description below
                  if (code >= 8) today_cond_times = [forecastTime.getHours()];
                } else if (code == today.code) {
                  // If condition is same as worst code and is drizzle or worse, add time for description
                  if (code >= 8) today_cond_times.push(forecastTime.getHours());
                }
              }
            }
          } else if (forecastTime < tomorrowEnd) {
            // Get high/low for tomorrow

            // Start with the last high./low from today
            if (tomorrow.high == -999) {
              if (today.high == -999)
                tomorrow.high = curr_temp;
              else
                tomorrow.high = d.list[i-1].main.temp_max;
            }
            if (tomorrow.low == 999) {
              if (today.low == 999)
                tomorrow.low = curr_temp;
              else
                tomorrow.low = d.list[i-1].main.temp_min;
            }

            if (DEBUG) console.log("Tomorrow Forecast: " + forecastTime + ", High: " + formatTempK(d.list[i].main.temp_max) + ", Low: " + formatTempK(d.list[i].main.temp_min));

            if (d.list[i].main.temp_max > tomorrow.high) tomorrow.high = d.list[i].main.temp_max;

            if (d.list[i].main.temp_min < tomorrow.low) tomorrow.low = d.list[i].main.temp_min;

            if (DEBUG) console.log("Tomorrow - running high: " + formatTempK(tomorrow.high) + ", running low: " + formatTempK(tomorrow.low));

            if (forecastTime <= tomorrowEndCondition) {
              // If earlier than 6pm tomorrow get 'worst' weather condition for tomorrow
              // where 'worst' is defined by the order of the condition codes (higher = worse)
              for (var k = 0; k < d.list[i].weather.length; k++) {
                if (DEBUG) console.log("Tomorrow Forecast: " + forecastTime + ", Condition: " + d.list[i].weather[k].id + " - " + d.list[i].weather[k].description);
                code = codeFromOWMId(d.list[i].weather[k].id);
                if (code > tomorrow.code) {
                  tomorrow.code = code;
                  tomorrow.condition = d.list[i].weather[k].description;
                  // If condition is drizzle or worse (rain, storms, etc) and is worst so far, save first time for adding to description below
                  if (code >= 8) tmrrw_cond_times = [forecastTime.getHours()];
                } else if (code == tomorrow.code) {
                  // If condition is same as worst code and is drizzle or worse, add time for description
                  if (code >= 8) tmrrw_cond_times.push(forecastTime.getHours());
                }
              }
            }
          } else {
            break;
          }
        }

        // Add condition times for any forecasts of drizzle or worse
        today.condition += conditionTimes2Text(today_cond_times);
        tomorrow.condition += conditionTimes2Text(tmrrw_cond_times);

        lastUpdate = new Date(curr_time);
        localStorage.setItem('lastUpdate', curr_time.toISOString());
        localStorage.setItem("forecastToday", JSON.stringify(today));
        localStorage.setItem("forecastTomorrow", JSON.stringify(tomorrow));

        if (forecast_date.getDate() == curr_time.getDate())
          forecast = today;
        else
          forecast = tomorrow;

        high = (forecast.high == -999 ? "" : formatTempK(forecast.high));
        low = (forecast.low == 999 ? "" : formatTempK(forecast.low));
        icon = (forecast.low == -1 ? 0 : forecast.code);
        condition = forecast.condition;

        if (DEBUG) {
          console.log('Current Temp: ' + formatTempK(curr_temp));
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
          console.log('Show Week: ' + config.ShowWeek);
          console.log('Show Steps: ' + config.ShowSteps);
          console.log('Location Changed: ' + locChanged);
          console.log('Wind Speed: ' + formatSpeedms(windspeed));
          console.log('Forecast time: ' + config.ForecastHour + ':' + config.ForecastMin);
          console.log('Quiet Time Start: ' + config.QTStartHour + ':' + config.QTStartMin);
          console.log('Quiet Time End: ' + config.QTEndHour + ':' + config.QTEndMin);
          console.log('Quite Time BT Vibes: ' + config.QTVibes);
          console.log('Quiet Time Fetch Weather: ' + config.QTFetch);
        }

        // Send the data to the Pebble
        Pebble.sendAppMessage({
            "status":status,
            "curr_temp":formatTempK(curr_temp),
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
            "show_week":config.ShowWeek,
            "show_steps":config.ShowSteps,
            "loc_changed":locChanged,
            "date_format":config.DateFormat,
            "show_wind":config.ShowWind,
            "wind_speed":formatSpeedms(windspeed),
            "forecast_hour":config.ForecastHour,
            "forecast_min":config.ForecastMin,
            "qt_start_hour":config.QTStartHour,
            "qt_start_min":config.QTStartMin,
            "qt_end_hour":config.QTEndHour,
            "qt_end_min":config.QTEndMin,
            "qt_bt_vibes":config.QTVibes,
            "qt_fetch_weather":config.QTFetch,
            "weather_update_interval":config.WeatherUpdateInterval,
            "weather_fetched":1});

      } else {
        console.warn("Error: " + reqForecast.status);

        if (reqForecast.status == 429) {
          // Server thinks we have made too many requests too quickly
          Pebble.sendAppMessage({
              "city":"Try later", // Show error briefly
              "weather_fetched":0});
        } else {
          Pebble.sendAppMessage({
              "city":"Err: " + reqForecast.status, // Show error briefly
              "weather_fetched":0});
        }
      }
    }
  };

  if (DEBUG) {
    console.log('Last update: ' + lastUpdate);
    console.log('Forecast data: ' + JSON.stringify(forecast));
    console.log('Mins since last update: ' + ((curr_time - lastUpdate) / 60000));
  }

  // Always fetch fresh weather data when requested
  // Initiate HTTP request for curent weather data
  reqCurrent.open('GET', 'http://api.openweathermap.org/data/2.5/weather?' + loc + '&appid=' + OWM_API_KEY, true);
  reqCurrent.send(null);
}

// Fetch the weather data from the NWS (weather.gov) web service and transmit to Pebble
function fetchNWSWeather(lat, lon) {

  if (DEBUG) console.log("### FETCHING NWS WEATHER ###");
  if (DEBUG) console.log('Using coordinates: ' + lat + ', ' + lon);

  var curr_time = new Date();

  var city, status, units, country = 'US';
  var curr_temp, sunrise, sunset, locChanged = 0, stationId = 0;
  var forecast_day, forecast_date, high, low, icon, condition;
  var auto_daymode, windspeed;
  var today, tomorrow, forecast;

  if (config.ForecastHour !== 0 && (curr_time.getHours() > config.ForecastHour ||
                                    (curr_time.getHours() == config.ForecastHour &&
                                     curr_time.getMinutes() >= config.ForecastMin))) {
    // Between set time and Midnight, show tomorrow's forecast
    forecast_day = 'Tomorrow';
    forecast_date = addDays(new Date(), 1);
    forecast = JSON.parse(localStorage.getItem('forecastTomorrow'));
  } else {
    // At all other times, show today's forecast
    forecast_day = 'Today';
    forecast_date = new Date();
    if (lastUpdate && lastUpdate.getDate() != curr_time.getDate())
      // If last update and current time are different days, we just crossed over midnight so show tomorrow forecast, but call it 'today'
      // to save all users trying to update at midnight and causing requests to hit limit
      forecast = JSON.parse(localStorage.getItem('forecastTomorrow'));
    else
      forecast = JSON.parse(localStorage.getItem('forecastToday'));
  }

  // Setup HTTP requests for points endpoint, observation stations, and forecast endpoint
  var reqPoints = new XMLHttpRequest();
  var reqStations = new XMLHttpRequest();
  var reqObservation = new XMLHttpRequest();
  var reqForecast = new XMLHttpRequest();

  // Store forecast URL for use across handlers
  var forecastUrl = null;

  // First, get the grid point information
  reqPoints.onload = function(e) {
    if (reqPoints.readyState == 4) {
      if (reqPoints.status == 200) {
        // Successfully retrieved points data

        var d;

        try {
          // Parse points data JSON
          d = JSON.parse(reqPoints.responseText);
        } catch(ex) {
          Pebble.sendAppMessage({
            "city":"Err: Bad Data",
            "weather_fetched":0});
          return;
        }

        // Validate data
        if (!d.properties) {
          Pebble.sendAppMessage({
            "city":"Err: Unknown Data",
            "weather_fetched":0});
          return;
        }

        // Get the forecast URL, observation stations URL, and city information
        forecastUrl = d.properties.forecast;
        var stationsUrl = d.properties.observationStations;
        city = d.properties.relativeLocation && d.properties.relativeLocation.properties ?
               d.properties.relativeLocation.properties.city : "Unknown";

        if (!forecastUrl) {
          Pebble.sendAppMessage({
            "city":"Err: No Forecast URL",
            "weather_fetched":0});
          return;
        }

        if (!stationsUrl) {
          Pebble.sendAppMessage({
            "city":"Err: No Stations URL",
            "weather_fetched":0});
          return;
        }

        // Determine temperature and wind-speed units
        if (!config.TempUnit || config.TempUnit === '' || config.TempUnit === 'Auto') {
          // NWS is US-only, so default to imperial
          units = 'imperial';
        } else {
          if (config.TempUnit == 'F')
            units = 'imperial';
          else
            units = 'metric';
        }

        lastUnits = units;
        localStorage.setItem('lastUnits', lastUnits);

        // Use grid coordinates as station ID
        stationId = d.properties.gridId + '_' + d.properties.gridX + '_' + d.properties.gridY;
        locChanged = (stationId == lastStationId ? 0 : 1);
        lastStationId = stationId;
        localStorage.setItem("lastStationId", stationId);
        localStorage.setItem("lastCity", city);

        // Now fetch the observation stations list
        reqStations.open('GET', stationsUrl, true);
        reqStations.setRequestHeader('User-Agent', 'PebbleForeCal/4.0 (contact: user@example.com)');
        reqStations.send(null);

      } else {
        console.warn("NWS Points Error: " + reqPoints.status);
        Pebble.sendAppMessage({
          "city":"NWS Err: " + reqPoints.status,
          "weather_fetched":0});
      }
    }
  };

  // Handle observation stations response
  reqStations.onload = function(e) {
    if (reqStations.readyState == 4) {
      if (reqStations.status == 200) {
        // Successfully retrieved stations data

        var d;

        try {
          // Parse stations data JSON
          d = JSON.parse(reqStations.responseText);
        } catch(ex) {
          log_message('Error parsing stations data: ' + ex.message);
          // Fall back to using forecast temperature
          fetchForecastData();
          return;
        }

        // Validate data and get first (nearest) station
        if (!d.features || d.features.length === 0) {
          log_message('No observation stations found');
          // Fall back to using forecast temperature
          fetchForecastData();
          return;
        }

        // Get the station ID from the first station
        var nearestStationId = d.features[0].properties.stationIdentifier;

        if (!nearestStationId) {
          log_message('No station identifier found');
          // Fall back to using forecast temperature
          fetchForecastData();
          return;
        }

        log_message('Using observation station: ' + nearestStationId);

        // Now fetch the latest observation from this station
        var observationUrl = 'https://api.weather.gov/stations/' + nearestStationId + '/observations/latest';
        reqObservation.open('GET', observationUrl, true);
        reqObservation.setRequestHeader('User-Agent', 'PebbleForeCal/4.0 (contact: user@example.com)');
        reqObservation.send(null);

      } else {
        console.warn("NWS Stations Error: " + reqStations.status);
        // Fall back to using forecast temperature
        fetchForecastData();
      }
    }
  };

  // Handle observation response
  reqObservation.onload = function(e) {
    if (reqObservation.readyState == 4) {
      if (reqObservation.status == 200) {
        // Successfully retrieved observation data

        var d;

        try {
          // Parse observation data JSON
          d = JSON.parse(reqObservation.responseText);
        } catch(ex) {
          log_message('Error parsing observation data: ' + ex.message);
          // Fall back to using forecast temperature
          fetchForecastData();
          return;
        }

        // Validate data and extract current temperature
        if (!d.properties || !d.properties.temperature || d.properties.temperature.value === null) {
          log_message('No current temperature in observation data');
          // Fall back to using forecast temperature
          fetchForecastData();
          return;
        }

        // Get current temperature (NWS observations return temperature in Celsius)
        var tempC = d.properties.temperature.value;

        // Convert to Fahrenheit for our internal use
        curr_temp = (tempC * 9/5) + 32;

        log_message('Current temperature from observation: ' + formatTempF(curr_temp));

        // Get wind speed if available (NWS observations return wind speed in km/h)
        windspeed = 0;
        if (d.properties.windSpeed && d.properties.windSpeed.value !== null) {
          // Convert km/h to mph
          windspeed = d.properties.windSpeed.value * 0.621371;
        }

        // Now fetch the forecast data
        fetchForecastData();

      } else {
        console.warn("NWS Observation Error: " + reqObservation.status);
        // Fall back to using forecast temperature
        fetchForecastData();
      }
    }
  };

  // Helper function to fetch forecast data (called after getting observation or on error)
  function fetchForecastData() {
    if (!forecastUrl) {
      console.warn("No forecast URL available");
      Pebble.sendAppMessage({
        "city":"Err: No Forecast URL",
        "weather_fetched":0});
      return;
    }
    reqForecast.open('GET', forecastUrl, true);
    reqForecast.setRequestHeader('User-Agent', 'PebbleForeCal/4.0 (contact: user@example.com)');
    reqForecast.send(null);
  }

  reqForecast.onload = function(e) {
    if (reqForecast.readyState == 4) {
      if (reqForecast.status == 200) {
        // Successfully retrieved forecast data

        var d;

        try {
          // Parse forecast data JSON
          d = JSON.parse(reqForecast.responseText);
        } catch(ex) {
          Pebble.sendAppMessage({
            "city":"Err: Bad Data",
            "weather_fetched":0});
          return;
        }

        // Validate data
        if (!d.properties || !d.properties.periods || d.properties.periods.length === 0) {
          Pebble.sendAppMessage({
            "city":"Err: No Forecast Data",
            "weather_fetched":0});
          return;
        }

        var periods = d.properties.periods;

        // Use forecast temperature as fallback only if we didn't get observation data
        if (typeof curr_temp === 'undefined' || curr_temp === null) {
          log_message('Using forecast temperature as fallback (no observation data available)');
          curr_temp = periods[0].temperature;
        }

        // Use forecast wind speed as fallback only if we didn't get observation data
        if (typeof windspeed === 'undefined' || windspeed === null || windspeed === 0) {
          windspeed = 0; // NWS doesn't provide numeric wind speed easily, would need to parse string

          // Parse wind speed if available (format: "5 to 10 mph")
          if (periods[0].windSpeed) {
            var windMatch = periods[0].windSpeed.match(/(\d+)\s*(?:to\s*(\d+))?\s*mph/i);
            if (windMatch) {
              windspeed = windMatch[2] ? parseInt(windMatch[2]) : parseInt(windMatch[1]);
            }
          }
        }

        daymode = 0;

        if (!config.ColorScheme || config.ColorScheme === '' || config.ColorScheme == 'Auto') {
          auto_daymode = 1;
        } else {
          auto_daymode = 0;
          daymode = (config.ColorScheme == 'WhiteOnBlack') ? 0 : 1;
        }

        // Calculate sunrise/sunset times using SunCalc
        var sunTimes = SunCalc.getTimes(curr_time, lat, lon);
        sunrise = sunTimes.sunrise;
        sunset = sunTimes.sunset;
        log_message('SunCalc sunrise: ' + sunrise.getHours() + ':' + sunrise.getMinutes());
        log_message('SunCalc sunset: ' + sunset.getHours() + ':' + sunset.getMinutes());

        // Determine day/night mode from actual sunrise/sunset times
        // (Don't use periods[0].isDaytime as that indicates the forecast period type, not current time of day)
        if (auto_daymode == 1) {
          if (curr_time >= sunset || curr_time < sunrise) {
            daymode = 0; // Nighttime
          } else {
            daymode = 1; // Daytime
          }
        }

        // Set the status display on the Pebble to the time of the weather update
        status = 'Upd: ' + timeStr(curr_time);

        localStorage.setItem('lastForecastUpdate', curr_time.toISOString());

        // Process forecast periods to get today and tomorrow
        today = { high: -999, low: 999, code: -1, condition: "" };
        tomorrow = { high: -999, low: 999, code: -1, condition: "" };

        var todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        var tomorrowDate = addDays(todayDate, 1);

        for (var i = 0; i < periods.length && i < 14; i++) {
          var period = periods[i];
          var periodDate = new Date(period.startTime);
          periodDate.setHours(0, 0, 0, 0);

          var isToday = (periodDate.getTime() === todayDate.getTime());
          var isTomorrow = (periodDate.getTime() === tomorrowDate.getTime());

          if (isToday) {
            // Update today's forecast
            if (period.isDaytime) {
              if (period.temperature > today.high || today.high === -999) {
                today.high = period.temperature;
              }

              // Get the most significant weather condition for today (daytime only)
              var code = codeFromNWSIcon(period.icon, period.shortForecast);
              log_message('Period ' + i + ' (' + period.name + '): icon=' + period.icon + ', forecast=' + period.shortForecast + ', code=' + code);
              if (code > today.code) {
                today.code = code;
                today.condition = period.shortForecast;
                log_message('  -> Updated today.code to ' + code + ', condition: ' + period.shortForecast);
              }
            } else {
              if (period.temperature < today.low || today.low === 999) {
                today.low = period.temperature;
              }
            }
          } else if (isTomorrow) {
            // Update tomorrow's forecast
            if (period.isDaytime) {
              if (period.temperature > tomorrow.high || tomorrow.high === -999) {
                tomorrow.high = period.temperature;
              }

              // Get the most significant weather condition for tomorrow (daytime only)
              var code2 = codeFromNWSIcon(period.icon, period.shortForecast);
              if (code2 > tomorrow.code) {
                tomorrow.code = code2;
                tomorrow.condition = period.shortForecast;
              }
            } else {
              if (period.temperature < tomorrow.low || tomorrow.low === 999) {
                tomorrow.low = period.temperature;
              }
            }
          }
        }

        lastUpdate = new Date(curr_time);
        localStorage.setItem('lastUpdate', curr_time.toISOString());
        localStorage.setItem("forecastToday", JSON.stringify(today));
        localStorage.setItem("forecastTomorrow", JSON.stringify(tomorrow));

        if (forecast_date.getDate() == curr_time.getDate())
          forecast = today;
        else
          forecast = tomorrow;

        high = (forecast.high == -999 ? "" : formatTempF(forecast.high));
        low = (forecast.low == 999 ? "" : formatTempF(forecast.low));
        icon = (forecast.code == -1 ? 0 : forecast.code);
        condition = forecast.condition;

        if (DEBUG) {
          console.log('Current Temp: ' + formatTempF(curr_temp));
          console.log('Sunrise: ' + sunrise.getHours() + ':' + sunrise.getMinutes());
          console.log('Sunset: ' + sunset.getHours() + ':' + sunset.getMinutes());
          console.log('Forecast Day: ' + forecast_day);
          console.log('Forecast Date: ' + forecast_date);
          console.log('Low: ' + low);
          console.log('High: ' + high);
          console.log('Condition: ' + condition);
          console.log('Icon: ' + icon);
          console.log('Daymode: ' + daymode);
          console.log('Auto Daymode: ' + auto_daymode);
          console.log('Location Changed: ' + locChanged);
          console.log('Wind Speed: ' + formatSpeedmph(windspeed));
        }

        // Send the data to the Pebble
        Pebble.sendAppMessage({
            "status":status,
            "curr_temp":formatTempF(curr_temp),
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
            "show_week":config.ShowWeek,
            "show_steps":config.ShowSteps,
            "loc_changed":locChanged,
            "date_format":config.DateFormat,
            "show_wind":config.ShowWind,
            "wind_speed":formatSpeedmph(windspeed),
            "forecast_hour":config.ForecastHour,
            "forecast_min":config.ForecastMin,
            "qt_start_hour":config.QTStartHour,
            "qt_start_min":config.QTStartMin,
            "qt_end_hour":config.QTEndHour,
            "qt_end_min":config.QTEndMin,
            "qt_bt_vibes":config.QTVibes,
            "qt_fetch_weather":config.QTFetch,
            "weather_update_interval":config.WeatherUpdateInterval,
            "weather_fetched":1});

      } else {
        console.warn("NWS Forecast Error: " + reqForecast.status);
        Pebble.sendAppMessage({
          "city":"NWS Err: " + reqForecast.status,
          "weather_fetched":0});
      }
    }
  };

  if (DEBUG) {
    console.log('Last update: ' + lastUpdate);
    console.log('Forecast data: ' + JSON.stringify(forecast));
    console.log('Mins since last update: ' + ((curr_time - lastUpdate) / 60000));
  }

  // Always fetch fresh weather data when requested
  // Initiate HTTP request for points data from NWS
  reqPoints.open('GET', 'https://api.weather.gov/points/' + lat + ',' + lon, true);
  reqPoints.setRequestHeader('User-Agent', 'PebbleForeCal/4.0 (contact: user@example.com)');
  reqPoints.send(null);
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

                          // Handle battery data from watch
                          if (e.payload !== undefined && e.payload.battery_percent !== undefined) {
                            var batteryPercent = e.payload.battery_percent;
                            var isCharging = e.payload.is_charging === 1;
                            if (DEBUG) console.log('Received battery data from watch: ' + batteryPercent + '% (charging: ' + isCharging + ')');
                            sendBatteryToEndpoint(batteryPercent, isCharging);
                            return; // Don't trigger weather refresh for battery messages
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
                             if (DEBUG) console.log("Raw settings returned: " + e.response);
                             try {
                               JSON.parse(e.response); // Test for Pebble app difference (iOS doesn't need decodeURIComponent, Android does)
                               config = clay.getSettings(e.response);
                             } catch(ex) {
                               config = clay.getSettings(decodeURIComponent(e.response));
                             }
                             if (DEBUG) console.log("Settings returned: " + JSON.stringify(config));
                             saveSettings();
                           }
                           else {
                             if (DEBUG) console.log("Settings cancelled");
                           }
                         });


