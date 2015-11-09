var DEBUG = false;
var APP_VER = "v2.7";
var daymode = 0;
var locationOptions = { "timeout": 15000, "maximumAge": 60000 }; 
var lastWOEID = 0;
var locChanged = false;
var time24hr = true;

var config = { 
  ColorScheme: 'Auto',
  ShowBT: true,
  BTVibes: true,
  ShowBatt: true,
  ForecastHour: 18,
  ForecastMin: 0,
  UseGPS: true,
  WeatherLoc: '',
  TempUnit: 'Auto',
  UpdateInterval: 20,
  FirstDay: 0,
  CalOffset: 0,
  ShowWind: false,
  DateFormat: 0
};

function loadSettings() {
  
  if (DEBUG) console.log('Loading settings...');
  
  if (localStorage.getItem('time24hr') !== null) {
    time24hr = (localStorage.getItem('time24hr') == 'true');
  }
  
  if (localStorage.getItem('config')) {
    try {
      config = JSON.parse(localStorage.getItem('config'));
    } catch(ex) {}
  } else {
    if (localStorage.colorScheme !== null) {
      config.ColorScheme = localStorage.colorScheme;
    }
    if (localStorage.showBT !== null) {
      config.ShowBT = (localStorage.showBT == 'true');
    }
    if (localStorage.btVibes !== null) {
      config.BTVibes = (localStorage.btVibes == 'true');
    }
    if (localStorage.showBatt !== null) {
      config.ShowBatt = (localStorage.showBatt == 'true');
    }
    if (localStorage.forecastHour !== null) {
      config.ForecastHour = localStorage.forecastHour;
    }
    if (localStorage.forecastMin !== null) {
      config.ForecastMin = localStorage.forecastMin;
    }
    if (localStorage.useGPS !== null) {
      config.UseGPS = (localStorage.useGPS == 'true');
    }
    if (localStorage.weatherLoc !== null) {
      config.WeatherLoc = localStorage.weatherLoc;
    }
    if (localStorage.tempUnit !== null) {
      config.TempUnit = localStorage.tempUnit;
    }
    if (localStorage.updateInterval !== null) {
      config.UpdateInterval = parseInt(localStorage.updateInterval);
    }
    if (localStorage.firstDay !== null) {
      config.FirstDay = parseInt(localStorage.firstDay);
    }
    if (localStorage.calOffset !== null) {
      config.CalOffset = parseInt(localStorage.calOffset);
    }
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
    if (saved.UseGPS !== null) {
      if (saved.UseGPS != config.UseGPS) refreshW = true;
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
      "update_interval":config.UpdateInterval,
      "first_day":config.FirstDay,
      "cal_offset":config.CalOffset,
      "daymode":daymode,
      "auto_daymode":(!config.ColorScheme || config.ColorScheme === '' || config.ColorScheme == 'Auto') ? 1 : 0,
      "show_bt":(config.ShowBT === true) ? 1 : 0,
      "bt_vibes":(config.BTVibes === true) ? 1 : 0,
      "show_batt":(config.ShowBatt === true) ? 1 : 0,
      "date_format":config.DateFormat,
      "show_wind":(config.ShowWind === true) ? 1 : 0,
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

// Parse time string into Javascript Date object
function parseTime(timeStr) {
 
    var time = timeStr.match(/(\d+)(?::(\d\d))?\s*(p?)/i);
    if (!time) {
        return NaN;
    }
    var hours = parseInt(time[1], 10);
    if (hours == 12 && !time[3]) {
        hours = 0;
    }
    else {
        hours += (hours < 12 && time[3]) ? 12 : 0;
    }
 
    var dt = new Date();
    dt.setHours(hours);
    dt.setMinutes(parseInt(time[2], 10) || 0);
    dt.setSeconds(0, 0);
    return dt;
}

// Decode entities in XML text
function decodeXML(xmlText) {
    if (new RegExp(/&amp;|&lt;|&gt;|&quot;|&apos;|&#39;/).test(xmlText)) {
        return xmlText.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'");
    } else {
      return xmlText;
    }
}

// (Very) Rudementary XML parser for getting a specified attribute value of given XML tag
// (This has to be done as there is no 'document' object in this Javascript environment)
function getXmlAttrVal(xml, tag, attrName) {
  var re = new RegExp('<' + tag + '(\\s+|\\s[^>]+\\s)' + attrName + '\\s*=\\s*"([^"]+)"[^>]*\/>', 'im');
  var parts = re.exec(xml);
  
  if (parts && parts.length == 3)
    return decodeXML(parts[2]);
  else
    return '';
}

// Add specified number of days to a Date
function addDays(date, days) {
    var result = new Date(date);
    result.setDate(date.getDate() + days);
    return result;
}

function locationSuccess(pos) {
  // Got our Lat/Long so now fetch the weather data
  var coordinates = pos.coords;
  if (DEBUG) console.log("GPS location: " + coordinates.latitude + ", " + coordinates.longitude);
  fetchWeather(coordinates.latitude + ',' + coordinates.longitude);
}

function locationError(err) {
  console.warn('Location error (' + err.code + '): ' + err.message);
  Pebble.sendAppMessage({
    "city":"GPS N/A",
    "weather_fetched":0
  });
}

function refreshWeather() {
  
  if (config.UseGPS) {
    // Trigger weather refresh by fetching location
    navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
  } else {
    fetchWeather(config.WeatherLoc);
  }
  
}

// Fetch the weather data from Yahoo and transmit to Pebble
function fetchWeather(loc) {
  
  if (DEBUG) console.log("### FETCHING WEATHER ###");
  
  var curr_time;
  curr_time = new Date();
  
  var country, city, woeid, unit, status;
  var reqLoc = new XMLHttpRequest();
  var reqWeather = new XMLHttpRequest();
  
  reqLoc.onload = function(e) {
    if (reqLoc.readyState == 4) {
      if(reqLoc.status == 200) {
        //console.log(reqLoc.responseText);
        var response = JSON.parse(reqLoc.responseText);
        var location = null;
        if (response && response.query && response.query.results && response.query.results.Result) { 
          if (response.query.results.Result.woeid && response.query.results.Result.woeid !== '') {
            // Single location result
            location = response.query.results.Result;
          } else if (response.query.results.Result[0].woeid && response.query.results.Result[0].woeid !== '') {
            // Pick the first result when there are multiple results
            location = response.query.results.Result[0];
          }
        }
        
        if (location) {
          // Successfully found our WOEID, so now we can trigger the fetch of the weather data
          country = location.countrycode;
          city = decodeXML(location.city);
          woeid = location.woeid;

          if (!config.UseGPS) {
            localStorage.woeid = woeid;
            localStorage.city = city;
            localStorage.country = country;
          }

          fetchWeatherData();
        } else {
          // WOEID not found
          Pebble.sendAppMessage({
            "city":"Loc. N/A",  // Show error breifly
            "weather_fetched":0}); 
        }

      } else {
        console.warn("Error: " + reqLoc.status);
        
        Pebble.sendAppMessage({
            "city":"Err: " + reqLoc.status, // Show error briefly
            "weather_fetched":0});
      }
    }
  };
  
  // Make HTTP call to get weather data
  function fetchWeatherData() {
    if (DEBUG) {
      console.log('Fetching weather data...');
      console.log('Country: ' + country);
      console.log('City: ' + city);
      console.log('WOEID: ' + woeid);
    }
    
    locChanged = (woeid != lastWOEID);
    lastWOEID = woeid;

    if (!config.TempUnit || config.TempUnit === '' || config.TempUnit === 'Auto') {
      // Determine temperature units from country code (US gets F, everyone else gets C)
      if (country == 'US')
        unit = 'F';
      else
        unit = 'C';
    } else {
      unit = config.TempUnit;
    }

    if (DEBUG) console.log('Unit: ' + unit);

    // URL for getting basic weather forecast data in XML format (RSS)
    reqWeather.open('GET', 'http://weather.yahooapis.com/forecastrss?w=' + woeid + '&u=' + unit.toLowerCase(), true);
    // Fetch the weather data
    reqWeather.send(null);
  }
  
  reqWeather.onload = function(e) {
    if (reqWeather.readyState == 4) {
      if(reqWeather.status == 200) {
        // Successfully retrieved weather data
        
        //console.log(reqWeather.responseText);
        
        var curr_temp, curr_temp_str, sunrise, sunrise_str, sunset, sunset_str;
        var curr_time, forecast_day, forecast_date, high, low, icon, condition;
        var auto_daymode, sun_rise_set, windspeed_val, windspeed;
        
        curr_time = new Date();
        
        // Get current temperature
        curr_temp_str = getXmlAttrVal(reqWeather.responseText, 'yweather:condition', 'temp');
        
        if (curr_temp_str === '')
          curr_temp = '';
        else
          curr_temp = getXmlAttrVal(reqWeather.responseText, 'yweather:condition', 'temp') + '\u00B0' + unit ;
        
        windspeed_val = Math.round(parseFloat(getXmlAttrVal(reqWeather.responseText, 'yweather:wind', 'speed')));
        if (isNaN(windspeed_val))
          windspeed = '';
        else
          windspeed = String(windspeed_val) + getXmlAttrVal(reqWeather.responseText, 'yweather:units', 'speed');
        
        sun_rise_set = ''; daymode = 0;
        
        // Get Sunrise and Sunset times, which also dictate if Daymode is on or not
        sunrise_str = getXmlAttrVal(reqWeather.responseText, 'yweather:astronomy', 'sunrise');
        sunset_str = getXmlAttrVal(reqWeather.responseText, 'yweather:astronomy', 'sunset');
        
        if (sunrise_str !== '' && sunset_str !== '') {
          sunrise = parseTime(sunrise_str);
          sunset = parseTime(sunset_str);
          
          if (!config.ColorScheme || config.ColorScheme === '' || config.ColorScheme == 'Auto') {
            if (!isNaN(sunrise) && !isNaN(sunset)) {
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
        
        if (!config.ColorScheme || config.ColorScheme === '' || config.ColorScheme == 'Auto') {
          auto_daymode = 1;
        }
        else {
          auto_daymode = 0;
          daymode = (config.ColorScheme == 'WhiteOnBlack') ? 0 : 1;
        }
        
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
        
        var reDate = new RegExp('\\sdate\\s*=\\s*"([^"]+)"');
        var reAttr = new RegExp('([^\\s=>"]+)\\s*=\\s*"([^"]+)"');
        var forecasts = reqWeather.responseText.match(/<yweather:forecast[^>]+>/img);
        
        var fd, attrs, attr, dateAttr;
        
        low = ''; high = ''; condition = ''; icon = 0;
        
        // Parse the forecast data out of the XML
        for (var i = 0; i < forecasts.length; i++) {
          dateAttr = reDate.exec(forecasts[i]);
          
          if (dateAttr && dateAttr.length == 2) {
            fd = new Date(dateAttr[1]);
            // Find the forecast data for today/tomorrow
            if (fd.getDate() == forecast_date.getDate()) {
              attrs = forecasts[i].match(/[^\s=>"]+\s*=\s*"[^"]+"/img);
              for (var a = 0; a < attrs.length; a++) {
                attr = reAttr.exec(attrs[a]);
                // Get all the weather forecast attribute values
                if (attr && attr.length == 3) {
                  if (attr[1].toLowerCase() == 'low' && attr[2] !== '')
                    low = attr[2] + '\u00B0' + unit;
                  else if (attr[1].toLowerCase() == 'high' && attr[2] !== '')
                    high = attr[2] + '\u00B0' + unit;
                  else if (attr[1].toLowerCase() == 'text' && attr[2] !== '')
                    condition = attr[2];
                  else if (attr[1].toLowerCase() == 'code' && attr[2] !== '')
                    icon = iconFromWeatherId(attr[2]);
                }
              }
              break;
            }
          }
        }
        
        // Set the status display on the Pebble to the time of the weather update
        if (time24hr) {
          status = 'Upd: ' + curr_time.getHours() + ':' + 
            (curr_time.getMinutes() < 10 ? '0' : '') + curr_time.getMinutes();
        } else {
          status = 'Upd: ' + (((curr_time.getHours() + 11) % 12) + 1) + ':' + 
            (curr_time.getMinutes() < 10 ? '0' : '') + curr_time.getMinutes() +
            (curr_time.getHours() >= 12 ? 'PM' : 'AM');
        }
        
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
          console.log('Show BT: ' + ((config.ShowBT === true) ? 1 : 0));
          console.log('BT Vibes: ' + ((config.BTVibes === true) ? 1 : 0));
          console.log('Show Battery: ' + ((config.ShowBatt === true) ? 1 : 0));
          console.log('Location Changed: ' + ((locChanged === true) ? 1 : 0));
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
            "show_bt":((config.ShowBT === true) ? 1 : 0),
            "bt_vibes":((config.BTVibes === true) ? 1 : 0),
            "show_batt":((config.ShowBatt === true) ? 1 : 0),
            "loc_changed":((locChanged === true) ? 1 : 0),
            "date_format":config.DateFormat,
            "show_wind":((config.ShowWind === true) ? 1 : 0),
            "wind_speed":windspeed,
            "weather_fetched":1});
      } else {
        console.warn("Error: " + reqWeather.status);
        
        Pebble.sendAppMessage({
            "city":"Err: " + reqWeather.status, // Show error briefly
            "weather_fetched":0});
      }
    }
  };
  
  if (!config.UseGPS && localStorage.woeid && localStorage.city && localStorage.country) {
    // If not using GPS and we have the details from the last location fetch, just fetch the weather
    if (DEBUG) console.log("WOEID Stored - " + localStorage.woeid);
    woeid = localStorage.woeid;
    city = localStorage.city;
    country = localStorage.country;
    fetchWeatherData();
  }
  else {
    if (DEBUG) console.log("Getting WOEID...");
    // URL for getting our WOEID from our current Lat/Long or City position in JSON format
    reqLoc.open('GET', 'http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20geo.placefinder%20where%20text%3D%22' + 
                 encodeURIComponent(loc) + '%22%20and%20gflags%3D%22R%22&format=json', true);
    reqLoc.send(null);
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
                           var settingsURL = 'http://www.cpinkney.net/ForeCal/Settings-2_0.html?config=' + 
                               encodeURIComponent(JSON.stringify(config)) + '&APP_VER=' + APP_VER;
                           if (DEBUG) console.log("Settings URL: " + settingsURL);
                           Pebble.openURL(settingsURL);
                          });

Pebble.addEventListener("webviewclosed",
                         function(e) {
                           if (DEBUG) console.log("Webview closed");
                           if (e.response) {
                             if (DEBUG) console.log("Settings returned: " + e.response);
                             try {
                               config = JSON.parse(e.response);
                             } catch(ex) {
                               config = JSON.parse(decodeURIComponent(e.response));
                             }
                             localStorage.removeItem("woeid");
                             localStorage.removeItem("city");
                             localStorage.removeItem("country");
                             saveSettings();
                           }
                           else {
                             if (DEBUG) console.log("Settings cancelled");
                           }
                         });


