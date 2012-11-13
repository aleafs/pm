/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var fs = require('fs');
var path = require('path');
var util = require('util');

var cluster = require('cluster');
var Emitter = require('events').EventEmitter;

/* {{{ private function mkdir() */
var mkdir = function (dir, mode) {
  if (path.existsSync(dir)) {
    return;
  }

  var p = path.dirname(dir);
  if (p && p != dir) {
    mkdir(p, mode);
  }
  fs.mkdirSync(dir, mode || 493/**< 0755*/);
};
/* }}} */

/* {{{ public Master constructor() */

var Master  = function (options) {

  Emitter.call(this);

  var _options = {
    'pidfile' : '',
    'statusfile' : '',
  };
  for (var i in options) {
    _options[i] = options[i];
  }

  if (_options.pidfile) {
    mkdir(path.dirname(_options.pidfile));
    fs.writeFileSync(_options.pidfile, process.pid);
    process.on('exit', function () {
      try {
        if (process.pid != fs.readFileSync(_options.pidfile, 'utf8')) {
          return;
        }
        fs.unlinkSync(_options.pidfile);
      } catch (e) {
      }
    });
  }
};
util.inherits(Master, Emitter);

/* }}} */

Master.prototype.setLogger = function (logger) {
};

Master.prototype.register = function (name, file, options, argv) {
};

Master.prototype.reload = function () {
};

Master.prototype.dispatch = function () {
};

exports.create = function (options) {
};

