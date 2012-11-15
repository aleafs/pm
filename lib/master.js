/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var fs = require('fs');
var path = require('path');
var util = require('util');
var Emitter = require('events').EventEmitter;

var PROCESS = process;
var CreateChild = require(__dirname + '/child.js').create;

/* {{{ private function _normalize() */
var _normalize  = function (name) {
  return name.toString().trim().toLowerCase();
};
/* }}} */

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

/* {{{ private function _writePidFile() */
var _writePidFile = function (fn) {
  mkdir(path.dirname(fn));
  fs.writeFileSync(fn, PROCESS.pid);
  PROCESS.on('exit', function () {
    try {
      var pid = fs.readFileSync(fn, 'utf8');
      if (Number(pid) === PROCESS.pid) {
        fs.unlinkSync(fn);
      }
    } catch (e) {
    }
  });
};
/* }}} */

exports.create = function (options) {

  /**
   * @ worker对象列表
   */
  var _workers = {};

  if (options && options.pidfile) {
    _writePidFile(options.pidfile);
  }

  if (options && options.statusfile) {
    mkdir(path.dirname(options.statusfile));
  }

  var Master = function () {
    Emitter.call(this);

    var _self = this;
    PROCESS.on('SIGHUB',  function () {});
    PROCESS.on('exit',    function () {
      _self.shutdown('SIGKILL');
    });

    PROCESS.on('SIGTERM', function () {
      _self.shutdown('SIGTERM');
      setTimeout(function () {
        PROCESS.exit(0);
      }, 1000);
    });

    PROCESS.on('SIGUSR1', function () {
      _self.reload();
    });
  };
  util.inherits(Master, Emitter);

  Master.prototype.register = function (name, file, options, argv) {
    name = _normalize(name);
    if (_workers[name]) {
      _workers[name].stop('SIGKILL');
    }

    argv = Array.isArray(argv) ? argv : [];
    argv.unshift(file);

    if (options && options.trace_gc) {
      argv.unshift('--trace_gc');
      delete options.trace_gc;
    }

    var _self = this;
    var _pair = CreateChild(argv, options);
    _pair.on('', function () {
    });

    _workers[name] = _pair;

    return _self;
  };

  Master.prototype.dispatch = function () {
    Object.keys(_workers).forEach(function (i) {
      _workers[i].start();
    });
  };

  Master.prototype.reload = function () {
    Object.keys(_workers).forEach(function (i) {
      _workers[i].reload();
    });
  };

  Master.prototype.shutdown = function () {
    Object.keys(_workers).forEach(function (i) {
      _workers[i].stop();
    });
  };

  return new Master();
};

