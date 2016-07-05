// Clay Configuration definition

var APP_VER = "v3.4";
module.exports = [
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Appearance/Misc."
      },
      {
        "type": "select",
        "appKey": "ColorScheme",
        "defaultValue": "Auto",
        "label": "Color Scheme",
        "description": "(Auto = Black on White during day, White on Black at night)",
        "options": [
          { 
            "label": "Auto", 
            "value": "Auto" 
          },
          { 
            "label": "White on Black",
            "value": "WhiteOnBlack" 
          },
          { 
            "label": "Black on White",
            "value": "BlackOnWhite" 
          }
        ],
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "toggle",
        "appKey": "ShowBT",
        "label": "Show Bluetooth Status",
        "defaultValue": true
      },
      {
        "type": "toggle",
        "appKey": "BTVibes",
        "label": "Vibrate on Connect/Disconnect",
        "defaultValue": true
      },
      {
        "type": "toggle",
        "appKey": "ShowBatt",
        "label": "Show Battery Status",
        "defaultValue": true
      },
      {
        "type": "toggle",
        "appKey": "ShowWind",
        "capabilities": ["NOT_ROUND"],
        "label": "Show wind speed instead of day name",
        "defaultValue": false
      },
      {
        "type": "select",
        "appKey": "DateFormat",
        "defaultValue": "0",
        "label": "Date Format",
        "options": [
          { 
            "label": "Month, Day", 
            "value": "0" 
          },
          { 
            "label": "Day, Month",
            "value": "1" 
          }
        ],
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "toggle",
        "appKey": "ShowWeek",
        "label": "Show Week Number",
        "description": "Displays instead of the AM/PM indicator when 12 hour clock is selected.",
        "defaultValue": false
      },
      {
        "type": "toggle",
        "appKey": "ShowSteps",
        "capabilities": ["HEALTH"],
        "label": "Show Steps Progress",
        "description": "Displays as a progress bar for average steps behind the Today/Tomorrow bar.",
        "defaultVaue": false
      }
    ]
  },
  
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Weather Settings"
      },
      {
        "type": "input",
        "appKey": "WeatherLoc",
        "defaultValue": "",
        "label": "Fixed Location",
        "description": "Leave blank to use GPS",
        "attributes": {
          "placeholder": "eg: New York, NY",
          "limit": 100,
        }
      },
      {
        "type": "input",
        "appKey": "ForecastTime",
        "defaultValue": "18:00",
        "label": "Show tomorrow's forecast after",
        "attributes": {
          "type": "time",
          "min": "13:00",
          "max": "00:00",
          "required": "required"
        }
      },
      {
        "type": "select",
        "appKey": "TempUnit",
        "defaultValue": "Auto",
        "label": "Temp/Wind Speed Units",
        "options": [
          { 
            "label": "Auto", 
            "value": "Auto" 
          },
          { 
            "label": "Celcius, m/s",
            "value": "C" 
          },
          { 
            "label": "Fahrenheit, mph",
            "value": "F" 
          }
        ],
        "attributes": {
          "required": "required"
        }
      }
    ]
  },
  
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Calendar"
      },
      {
        "type": "select",
        "appKey": "FirstDay",
        "defaultValue": "0",
        "label": "First Day of Week",
        "options": [
          { 
            "label": "Sunday", 
            "value": "0" 
          },
          { 
            "label": "Monday",
            "value": "1" 
          }
        ],
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "select",
        "appKey": "CalOffset",
        "defaultValue": "0",
        "label": "Calendar Weeks",
        "options": [
          { 
            "label": "Last wk + this wk + next wk", 
            "value": "0" 
          },
          { 
            "label": "This week + next 2 weeks",
            "value": "7" 
          }
        ],
        "attributes": {
          "required": "required"
        }
      }
    ]
  },
  
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Quiet Time"
      },
      {
        "type": "input",
        "appKey": "QTStart",
        "defaultValue": "00:15",
        "label": "Start",
        "attributes": {
          "type": "time",
          "min": "00:00",
          "max": "23:59",
          "required": "required"
        }
      },
      {
        "type": "input",
        "appKey": "QTEnd",
        "defaultValue": "06:30",
        "label": "End",
        "attributes": {
          "type": "time",
          "min": "00:00",
          "max": "23:59",
          "required": "required"
        }
      },
      {
        "type": "toggle",
        "appKey": "QTVibes",
        "label": "Vibrate on BT Disconnect/Connect during Quiet Time",
        "defaultValue": true
      },
      {
        "type": "toggle",
        "appKey": "QTFetch",
        "label": "Fetch weather during Quiet Time",
        "defaultValue": false
      }
    ]
  },
  
  {
    "type": "text",
    "defaultValue": "Weather data provided by OpenWeatherMap.org"
  },
  
  {
    "type": "submit",
    "defaultValue": "Save"
  },
  
  {
    "type": "text",
    "defaultValue": APP_VER
  }
];