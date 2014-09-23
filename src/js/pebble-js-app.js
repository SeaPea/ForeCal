var DEBUG = true;
var lastSuccess;
var daymode;

var cfgColorScheme = 'Auto';
var cfgForecastHour = 18;
var cfgForecastMin = 0;
var cfgUseGPS = true;
var cfgWeatherLoc = '';
var cfgTempUnit = 'Auto';
var cfgUpdateInterval = 20;
var cfgFirstDay = 0;
var cfgCalOffset = 0;

function loadSettings() {
  
  if (DEBUG) console.log('Loading settings');
  
  if (localStorage.colorScheme)
    cfgColorScheme = localStorage.colorScheme;
  
  if (localStorage.forecastHour)
    cfgForecastHour = localStorage.forecastHour;
  
  if (localStorage.forecastMin)
    cfgForecastMin = localStorage.forecastMin;
  
  if (localStorage.useGPS)
    cfgUseGPS = localStorage.useGPS;
  
  if (localStorage.weatherLoc)
    cfgWeatherLoc = localStorage.weatherLoc;
  
  if (localStorage.tempUnit)
    cfgTempUnit = localStorage.tempUnit;
  
  if (localStorage.updateInterval)
    cfgUpdateInterval = localStorage.updateInterval;
  
  if (localStorage.firstDay)
    cfgFirstDay = localStorage.firstDay;
  
  if (localStorage.calOffset)
    cfgCalOffset = localStorage.calOffset;
}

function saveSettings(settings) {
  
  if (DEBUG) console.log('Saving settings');
  
  if (settings) {
    if (settings.ColorScheme)
      cfgColorScheme = settings.ColorScheme;
    
    if (settings.ForecastHour)
      cfgForecastHour = settings.ForecastHour;
    
    if (settings.ForecastMin)
      cfgForecastMin = settings.ForecastMin;
    
    if (settings.UseGPS)
      cfgUseGPS = settings.UseGPS;
    
    if (settings.WeatherLoc)
      cfgWeatherLoc = settings.WeatherLoc;
    
    if (settings.TempUnit)
      cfgTempUnit = settings.TempUnit;
    
    if (settings.UpdateInterval)
      cfgUpdateInterval = settings.UpdateInterval;
    
    if (settings.FirstDay)
      cfgFirstDay = settings.FirstDay;
    
    if (settings.CalOffset)
      cfgCalOffset = settings.CalOffset;
  }
    
  localStorage.colorScheme = cfgColorScheme;
  localStorage.forecastHour = cfgForecastHour;
  localStorage.forecastMin = cfgForecastMin;
  localStorage.useGPS = cfgUseGPS;
  localStorage.weatherLoc = cfgWeatherLoc;
  localStorage.tempUnit = cfgTempUnit;
  localStorage.updateInterval = cfgUpdateInterval;
  localStorage.firstDay = cfgFirstDay;
  localStorage.calOffset = cfgCalOffset;
  
  if (DEBUG) console.log('Sending settings');
  
  // Send misc settings to the Pebble
  Pebble.sendAppMessage({
    "update_interval":cfgUpdateInterval,
    "first_day":cfgFirstDay,
    "cal_offset":cfgCalOffset,
    "daymode":daymode,
    "auto_daymode":(!cfgColorScheme || cfgColorScheme === '' || cfgColorScheme == 'Auto') ? 1 : 0
  });
    
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
    case '45': //thundershowers
    case '47': //isolated thundershowers
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

// (Very) Rudementary XML parser for getting a specified attribute value of given XML tag
// (This has to be done as there is no 'document' object in this Javascript environment)
function getXmlAttrVal(xml, tag, attrName) {
  var re = new RegExp('<' + tag + '(\\s+|\\s[^>]+\\s)' + attrName + '\\s*=\\s*"([^"]+)"[^>]*\/>', 'im');
  var parts = re.exec(xml);
  
  if (parts && parts.length == 3)
    return parts[2];
  else
    return '';
}

// Add specified number of days to a Date
function addDays(date, days) {
    var result = new Date(date);
    result.setDate(date.getDate() + days);
    return result;
}

// Fetch the weather data from Yahoo and transmit to Pebble
function fetchWeather(latitude, longitude) {
  
  if (DEBUG) console.log("### FETCHING WEATHER ###");
  
  var curr_time;
  curr_time = new Date();
  
  // Don't fetch weather again unless it was over 20 minutes ago
  if (lastSuccess && Math.round((curr_time - lastSuccess) / 60000) <= 20) {
    if (DEBUG) console.log("Not fetching - less than 20 minutes since last success: " + Math.round((curr_time - lastSuccess) / 60000));
    return;
  }
  
  var country, city, woeid, unit, status;
  var reqLoc = new XMLHttpRequest();
  var reqWeather = new XMLHttpRequest();
  // URL for getting our WOEID from our current Lat/Long position in JSON format
  reqLoc.open('GET', 'http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20geo.placefinder%20where%20text%3D%22' + 
               latitude + '%2C' + longitude + '%22%20and%20gflags%3D%22R%22&format=json', true);
  
  reqLoc.onload = function(e) {
    if (reqLoc.readyState == 4) {
      if(reqLoc.status == 200) {
        //console.log(reqLoc.responseText);
        var response = JSON.parse(reqLoc.responseText);
        if (response && response.query && response.query.results && response.query.results.Result && 
            response.query.results.Result.woeid && response.query.results.Result.woeid !== '') {
          // Successfully found our WOEID, so now we can trigger the fetch of the weather data
          var location = response.query.results.Result;
          country = location.countrycode;
          city = location.city;
          woeid = location.woeid;
          if (DEBUG) {
            console.log('Country: ' + country);
            console.log('City: ' + city);
            console.log('WOEID: ' + woeid);
          }
          
          // Determine temperature units from country code (US gets F, everyone else gets C)
          if (country == 'US')
            unit = 'F';
          else
            unit = 'C';
          
          if (DEBUG) console.log('Unit: ' + unit);
          
          // URL for getting basic weather forecast data in XML format (RSS)
          reqWeather.open('GET', 'http://weather.yahooapis.com/forecastrss?w=' + woeid + '&u=' + unit.toLowerCase(), true);
          // Fetch the weather data
          reqWeather.send(null);
        } else {
          // WOEID not found
          Pebble.sendAppMessage({
            "city":"Loc. N/A"}); // Show error breifly
        }

      } else {
        console.warn("Error: " + reqLoc.status);
        
        Pebble.sendAppMessage({
            "city":"Err: " + reqLoc.status}); // Show error briefly
      }
    }
  };
  
  reqWeather.onload = function(e) {
    if (reqWeather.readyState == 4) {
      if(reqWeather.status == 200) {
        // Successfully retrieved weather data
        
        //console.log(reqWeather.responseText);
        
        var curr_temp, curr_temp_str, sunrise, sunrise_str, sunset, sunset_str;
        var curr_time, forecast_day, forecast_date, high, low, icon, condition;
        var auto_daymode, sun_rise_set;
        
        curr_time = new Date();
        
        // Get current temperature
        curr_temp_str = getXmlAttrVal(reqWeather.responseText, 'yweather:condition', 'temp');
        
        if (curr_temp_str === '')
          curr_temp = '';
        else
          curr_temp = getXmlAttrVal(reqWeather.responseText, 'yweather:condition', 'temp') + '\u00B0' + unit ;
        
        sun_rise_set = ''; daymode = 0;
        
        // Get Sunrise and Sunset times, which also dictate if Daymode is on or not
        sunrise_str = getXmlAttrVal(reqWeather.responseText, 'yweather:astronomy', 'sunrise');
        sunset_str = getXmlAttrVal(reqWeather.responseText, 'yweather:astronomy', 'sunset');
        
        if (sunrise_str !== '' && sunset_str !== '') {
          sunrise = parseTime(sunrise_str);
          sunset = parseTime(sunset_str);
          
          if (!cfgColorScheme || cfgColorScheme === '' || cfgColorScheme == 'Auto') {
            if (!isNaN(sunrise) && !isNaN(sunset)) {
              if (curr_time >= sunset || curr_time < sunrise) {
                // Nighttime
                //sun_rise_set = sunrise.getHours() + ':' + (sunrise.getMinutes() < 10 ? '0' : '') + sunrise.getMinutes();
                daymode = 0;
              } else {
                // Daytime
                //sun_rise_set = sunset.getHours() + ':' + (sunset.getMinutes() < 10 ? '0' : '') + sunset.getMinutes();
                daymode = 1;
              }
            }
          }
        }
        
        if (!cfgColorScheme || cfgColorScheme === '' || cfgColorScheme == 'Auto') {
          auto_daymode = 1;
        }
        else {
          auto_daymode = 0;
          daymode = (cfgColorScheme == 'WhiteOnBlack') ? 0 : 1;
        }
          
        
        if (curr_time.getHours() >= 18) {
          // Between 6pm and Midnight, show tomorrow's forecast
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
        status = 'Upd: ' + curr_time.getHours() + ':' + 
          (curr_time.getMinutes() < 10 ? '0' : '') + curr_time.getMinutes();
        
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
        }
        
        lastSuccess = curr_time;
        
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
            "update_interval":cfgUpdateInterval,
            "first_day":cfgFirstDay,
            "cal_offset":cfgCalOffset});
      } else {
        console.warn("Error: " + reqWeather.status);
        
        Pebble.sendAppMessage({
            "city":"Err: " + reqWeather.status}); // Show error briefly
      }
    }
  };
  
  // Get the WOEID for the current location, which will trigger the weather to be fetched
  reqLoc.send(null);
}

function locationSuccess(pos) {
  // Got our Lat/Long so now fetch the weather data
  var coordinates = pos.coords;
  if (DEBUG) console.log("GPS location: " + coordinates.latitude + ", " + coordinates.longitude);
  fetchWeather(coordinates.latitude, coordinates.longitude);
}

function locationError(err) {
  console.warn('Location error (' + err.code + '): ' + err.message);
  Pebble.sendAppMessage({
    "city":"GPS N/A"
  });
}

var locationOptions = { "timeout": 15000, "maximumAge": 60000 }; 


Pebble.addEventListener("ready",
                        function(e) {
                          if (DEBUG) console.log("JS Ready");
                          loadSettings();
                          // Trigger location and weather fetch on load
                          locationWatcher = window.navigator.geolocation.watchPosition(locationSuccess, locationError, locationOptions);
                        });

Pebble.addEventListener("appmessage",
                        function(e) {
                          // Trigger location and weather fetch on command from Pebble
                          lastSuccess = null;
                          window.navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
                          if (DEBUG) console.log("Pebble App Message!");
                        });

Pebble.addEventListener("showConfiguration", 
                         function() {
                           console.log("Showing Settings");
                           var settingsURL = 'http://www.cpinkney.net/ForeCal/Settings-0_9.html?ColorScheme=' + cfgColorScheme + '&ForecastHour=' + cfgForecastHour +
                                         '&ForecastMin=' + cfgForecastMin + '&UseGPS=' + cfgUseGPS + '&WeatherLoc=' + encodeURIComponent(cfgWeatherLoc) + '&TempUnit=' + cfgTempUnit +
                                         '&UpdateInterval=' + cfgUpdateInterval + '&FirstDay=' + cfgFirstDay + '&CalOffset=' + cfgCalOffset;
                           if (DEBUG) console.log("Settings URL: " + settingsURL);
                           Pebble.openURL(settingsURL);
                          });

Pebble.addEventListener("webviewclosed",
                         function(e) {
                           if (DEBUG) console.log("Webview closed");
                           if (e.response) {
                             var settings = JSON.parse(decodeURIComponent(e.response));
                             if (DEBUG) console.log("Settings returned: " + JSON.stringify(settings));
                             saveSettings(settings);
                           }
                           else {
                             if (DEBUG) console.log("Settings cancelled");
                           }
                         });


