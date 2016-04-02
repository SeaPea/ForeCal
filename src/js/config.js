// Clay Configuration definition

var APP_VER = "v3.1";
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
        "defaultValue": true,
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "toggle",
        "appKey": "BTVibes",
        "label": "Vibrate on Connect/Disconnect",
        "defaultValue": true,
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "toggle",
        "appKey": "ShowBatt",
        "label": "Show Battery Status",
        "defaultValue": true,
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "toggle",
        "appKey": "ShowWind",
        "label": "Show wind speed instead of day name",
        "defaultValue": false,
        "attributes": {
          "required": "required"
        }
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
        "type": "select",
        "appKey": "ForecastHour",
        "defaultValue": "18",
        "label": "Show tomorrow's forecast after hour",
        "options": [
          { "label": "13", "value": "13"  },
          { "label": "14", "value": "14"  },
          { "label": "15", "value": "15"  },
          { "label": "16", "value": "16"  },
          { "label": "17", "value": "17"  },
          { "label": "18", "value": "18"  },
          { "label": "19", "value": "19"  },
          { "label": "20", "value": "20"  },
          { "label": "21", "value": "21"  },
          { "label": "22", "value": "22"  },
          { "label": "23", "value": "23"  },
          { "label": "00", "value": "0"  }
        ],
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "select",
        "appKey": "ForecastMin",
        "defaultValue": "0",
        "label": "...and minute",
        "options": [
          { "label": "00", "value": "0"  },
          { "label": "15", "value": "15"  },
          { "label": "30", "value": "30"  },
          { "label": "45", "value": "45"  }
        ],
        "attributes": {
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
        "type": "select",
        "appKey": "QTStartHour",
        "defaultValue": "0",
        "label": "Start Hour",
        "options": [
          { "label": "1", "value": "1"  },
          { "label": "2", "value": "2"  },
          { "label": "3", "value": "3"  },
          { "label": "4", "value": "4"  },
          { "label": "5", "value": "5"  },
          { "label": "6", "value": "6"  },
          { "label": "7", "value": "7"  },
          { "label": "8", "value": "8"  },
          { "label": "9", "value": "9"  },
          { "label": "10", "value": "10"  },
          { "label": "11", "value": "11"  },
          { "label": "12", "value": "12"  },
          { "label": "13", "value": "13"  },
          { "label": "14", "value": "14"  },
          { "label": "15", "value": "15"  },
          { "label": "16", "value": "16"  },
          { "label": "17", "value": "17"  },
          { "label": "18", "value": "18"  },
          { "label": "19", "value": "19"  },
          { "label": "20", "value": "20"  },
          { "label": "21", "value": "21"  },
          { "label": "22", "value": "22"  },
          { "label": "23", "value": "23"  },
          { "label": "00", "value": "0"  }
        ],
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "select",
        "appKey": "QTStartMin",
        "defaultValue": "15",
        "label": "Start Minute",
        "options": [
          { "label": "00", "value": "0"  },
          { "label": "15", "value": "15"  },
          { "label": "30", "value": "30"  },
          { "label": "45", "value": "45"  }
        ],
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "select",
        "appKey": "QTEndHour",
        "defaultValue": "6",
        "label": "End Hour",
        "options": [
          { "label": "1", "value": "1"  },
          { "label": "2", "value": "2"  },
          { "label": "3", "value": "3"  },
          { "label": "4", "value": "4"  },
          { "label": "5", "value": "5"  },
          { "label": "6", "value": "6"  },
          { "label": "7", "value": "7"  },
          { "label": "8", "value": "8"  },
          { "label": "9", "value": "9"  },
          { "label": "10", "value": "10"  },
          { "label": "11", "value": "11"  },
          { "label": "12", "value": "12"  },
          { "label": "13", "value": "13"  },
          { "label": "14", "value": "14"  },
          { "label": "15", "value": "15"  },
          { "label": "16", "value": "16"  },
          { "label": "17", "value": "17"  },
          { "label": "18", "value": "18"  },
          { "label": "19", "value": "19"  },
          { "label": "20", "value": "20"  },
          { "label": "21", "value": "21"  },
          { "label": "22", "value": "22"  },
          { "label": "23", "value": "23"  },
          { "label": "00", "value": "0"  }
        ],
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "select",
        "appKey": "QTEndMin",
        "defaultValue": "30",
        "label": "End Minute",
        "options": [
          { "label": "00", "value": "0"  },
          { "label": "15", "value": "15"  },
          { "label": "30", "value": "30"  },
          { "label": "45", "value": "45"  }
        ],
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "toggle",
        "appKey": "QTVibes",
        "label": "Vibrate on BT Disconnect/Connect during Quiet Time",
        "defaultValue": true,
        "attributes": {
          "required": "required"
        }
      },
      {
        "type": "toggle",
        "appKey": "QTFetch",
        "label": "Fetch weather during Quiet Time",
        "defaultValue": false,
        "attributes": {
          "required": "required"
        }
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