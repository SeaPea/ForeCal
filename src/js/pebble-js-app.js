
var monthNames = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

function iconFromWeatherId(weatherId) {
  if (weatherId < 600) {
    return 2;
  } else if (weatherId < 700) {
    return 3;
  } else if (weatherId > 800) {
    return 1;
  } else {
    return 0;
  }
}

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

function getXmlAttrVal(xml, tag, attrName) {
  var re = new RegExp('<' + tag + '(\\s+|\\s[^>]+\\s)' + attrName + '\\s*=\\s*"([^"]+)"[^>]*\/>', 'im');
  return re.exec(xml)[2];
}

function addDays(date, days) {
    var result = new Date(date);
    result.setDate(date.getDate() + days);
    return result;
}

function fetchWeather(latitude, longitude) {
  var country, city, woeid, unit;
  var reqLoc = new XMLHttpRequest();
  var reqWeather = new XMLHttpRequest();
  reqLoc.open('GET', 'http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20geo.placefinder%20where%20text%3D%22' + 
               latitude + '%2C' + longitude + '%22%20and%20gflags%3D%22R%22&format=json', true);
  
  reqLoc.onload = function(e) {
    if (reqLoc.readyState == 4) {
      if(reqLoc.status == 200) {
        console.log(reqLoc.responseText);
        var response = JSON.parse(reqLoc.responseText);
        if (response && response.query && response.query.results && response.query.results.Result) {
          var location = response.query.results.Result;
          country = location.countrycode;
          city = location.city;
          woeid = location.woeid;
          console.log('Country: ' + country);
          console.log('City: ' + city);
          console.log('WOEID: ' + woeid);
          
          if (country == 'US')
            unit = 'F';
          else
            unit = 'C';
          
          console.log('Unit: ' + unit);
          
          reqWeather.open('GET', 'http://weather.yahooapis.com/forecastrss?w=' + woeid + '&u=' + unit.toLowerCase(), true);
          reqWeather.send(null);
        }

      } else {
        console.log("Error");
      }
    }
  };
  
  reqWeather.onload = function(e) {
    if (reqWeather.readyState == 4) {
      if(reqWeather.status == 200) {
        console.log(reqWeather.responseText);
        
        var curr_temp, sunrise, sunset, curr_time, forecast_day, forecast_date, high, low, icon, condition;
        
        curr_temp = getXmlAttrVal(reqWeather.responseText, 'yweather:condition', 'temp') + '\u00B0' + unit ;
        sunrise = parseTime(getXmlAttrVal(reqWeather.responseText, 'yweather:astronomy', 'sunrise'));
        sunset = parseTime(getXmlAttrVal(reqWeather.responseText, 'yweather:astronomy', 'sunset'));
        
        curr_time = new Date();
        
        if (curr_time.getHours() >= 18) {
          forecast_day = 'Tomorrow';
          forecast_date = addDays(new Date(), 1);
        } else {
          forecast_day = 'Today';
          forecast_date = new Date();
        }
        
        var reDate = new RegExp('\\sdate\\s*=\\s*"([^"]+)"');
        var reAttr = new RegExp('([^\\s=>"]+)\\s*=\\s*"([^"]+)"');
        var forecasts = reqWeather.responseText.match(/<yweather:forecast[^>]+>/img);
        
        var fd, attrs, attr;
        
        for (var i = 0; i < forecasts.length; i++) {
          fd = new Date(reDate.exec(forecasts[i])[1]);
          
          if (fd.getDate() == forecast_date.getDate()) {
            attrs = forecasts[i].match(/[^\s=>"]+\s*=\s*"[^"]+"/img);
            for (var a = 0; a < attrs.length; a++) {
              attr = reAttr.exec(attrs[a]);
              if (attr[1].toLowerCase() == 'low')
                low = attr[2];
              else if (attr[1].toLowerCase() == 'high')
                high = attr[2];
              else if (attr[1].toLowerCase() == 'text')
                condition = attr[2];
              else if (attr[1].toLowerCase() == 'code')
                icon = iconFromWeatherId(attr[2]);
            }
            break;
          }
        }
        
        console.log('Current Temp: ' + curr_temp);
        console.log('Sunrise: ' + sunrise.getHours() + ':' + sunrise.getMinutes());
        console.log('Sunrise: ' + sunset.getHours() + ':' + sunset.getMinutes());
        console.log('Forecast Day: ' + forecast_day);
        console.log('Forecast Date: ' + forecast_date);
        console.log('Low: ' + low);
        console.log('High: ' + high);
        console.log('Condition: ' + condition);
        console.log('Icon: ' + icon);
        
        console.log('Forecasts: ' + forecasts.length);
        
        Pebble.sendAppMessage({
            "icon":1,
            "temperature":curr_temp,
            "city":city});
      } else {
        console.log("Error");
      }
    }
  };
  
  // Get the WOEID for the current location, which will trigger the weather to be fetched
  reqLoc.send(null);
}

function locationSuccess(pos) {
  var coordinates = pos.coords;
  fetchWeather(coordinates.latitude, coordinates.longitude);
}

function locationError(err) {
  console.warn('location error (' + err.code + '): ' + err.message);
  Pebble.sendAppMessage({
    "city":"Loc Unavailable",
    "temperature":"N/A"
  });
}

var locationOptions = { "timeout": 15000, "maximumAge": 60000 }; 


Pebble.addEventListener("ready",
                        function(e) {
                          console.log("connect!" + e.ready);
                          locationWatcher = window.navigator.geolocation.watchPosition(locationSuccess, locationError, locationOptions);
                          console.log(e.type);
                        });

Pebble.addEventListener("appmessage",
                        function(e) {
                          window.navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
                          console.log(e.type);
                          console.log(e.payload.temperature);
                          console.log("message!");
                        });

Pebble.addEventListener("webviewclosed",
                                     function(e) {
                                     console.log("webview closed");
                                     console.log(e.type);
                                     console.log(e.response);
                                     });


