// Simple module loader for Pebble.js
var __loader = (function() {
  var modules = {};

  return {
    define: function(path, lineno, factory) {
      modules[path] = {
        factory: factory,
        exports: {},
        loaded: false
      };
    },

    require: function(path) {
      // Normalize the path - remove leading './'
      if (path.indexOf('./') === 0) {
        path = path.substring(2);
      }

      // Try to find the module
      var module = modules[path];

      // If not found, try adding .js extension
      if (!module && path.indexOf('.js') === -1) {
        module = modules[path + '.js'];
      }

      // If still not found, try adding .json extension
      if (!module && path.indexOf('.json') === -1) {
        module = modules[path + '.json'];
      }

      if (!module) {
        throw new Error('Module not found: ' + path);
      }

      if (!module.loaded) {
        module.loaded = true;
        var moduleObj = { exports: module.exports };
        module.factory(module.exports, moduleObj, this.require.bind(this));
        module.exports = moduleObj.exports;
      }

      return module.exports;
    }
  };
})();

