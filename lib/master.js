/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var fs = require('fs');
var path = require('path');
var util = require('util');
var Emitter = require('events').EventEmitter;

var PROCESS = process;
var child = require(__dirname + '/child.js');

/* {{{ private function _normalize() */
var _normalize  = function (name) {
  return name.toString().trim().toLowerCase();
};
/* }}} */

/* {{{ private function mkdir() */
var mkdir = function (dir, mode) {
  if ((fs.existsSync || path.existsSync)(dir)) {
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

  var _options = {
    'terminate_timeout' : 1000,
    'statusflush_interval'  : 1000,
    'addr': '0.0.0.0'
  };
  for (var i in options) {
    _options[i] = options[i];
  }

  /**
   * @ worker对象列表
   */
  var _workers = {};

  if (_options.pidfile) {
    _writePidFile(_options.pidfile);
  }

  if (_options.statusfile) {
    mkdir(path.dirname(_options.statusfile));
    (function statusfile() {
      var _stream = fs.createWriteStream(_options.statusfile, {
        'flags': 'a+', 'encoding': 'utf8', 'mode': 420   // 0644
      });
      Object.keys(_workers).forEach(function (i) {
        Object.keys(_workers[i].pstatus).forEach(function (p) {
          _stream.write(util.format('%d:\t%s\t%s\t%j\n', 
              process.pid, i, p, _workers[i].pstatus[p]));
        });
      });
      _stream.end();
      setTimeout(statusfile, _options.statusflush_interval);
    })();
  }

  var Master = function () {
    Emitter.call(this);

    var _self = this;

    PROCESS.on('SIGHUB',  function () {
      _self.emit('signal', 1, 'SIGHUB');
    });
    PROCESS.on('exit',    function () {
      _self.shutdown('SIGKILL');
    });

    PROCESS.on('SIGTERM', function (signal, code) {
      _self.emit('signal', code || 15, signal || 'SIGTERM');
      _self.shutdown('SIGTERM');
      setTimeout(function () {
        PROCESS.exit(0);
      }, _options.terminate_timeout);
    });

    PROCESS.on('SIGINT', function () {
      PROCESS.emit('SIGTERM', 'SIGINT', 2);
    });

    PROCESS.on('SIGUSR1', function () {
      _self.emit('signal', 30, 'SIGUSR1');
      _self.reload();
    });
  };
  util.inherits(Master, Emitter);

  /* {{{ public prototype register() */
  Master.prototype.register = function (name, file, options, argv) {
    name = _normalize(name);
    if (_workers[name]) {
      _workers[name].removeAllListeners();
      _workers[name].stop('SIGKILL');
    }

    argv = Array.isArray(argv) ? argv : [];
    argv.unshift(file);

    if (options && options.trace_gc) {
      argv.unshift('--trace_gc');
      delete options.trace_gc;
    }

    var _self = this;
    var _pair = child.create(argv, options);
    _pair.on('fork', function (pid) {
      _self.emit('fork', name, pid);
    });
    _pair.on('exit', function (pid, code, signal) {
      _self.emit('quit', name, pid, code, signal);
    });
    _pair.on('giveup', function (n, p) {
      _self.emit('giveup', name, n, p);
    });
    _pair.on('broadcast', function (to, msg, pid, xxx) {
      to = _normalize(to);
      if (_workers[to]) {
        _workers[to].broadcast(msg, name, pid, xxx);
      }
    });
    _pair.on('disconnect', function (pid, worker) {
      _self.emit('disconnect', name, pid, worker);
    });
    _workers[name] = _pair;

    return _pair;
  };
  /* }}} */

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

  Master.prototype.shutdown = function (signal) {
    Object.keys(_workers).forEach(function (i) {
      _workers[i].stop(signal || 'SIGTERM');
    });
  };

  Master.prototype.fork = function (name) {
    var _pair = _workers[name];
    return _pair.fork();
  };

  return new Master();
};

if (process.env.NODE_ENV === 'test') {
  exports.mock = function (p) {
    PROCESS = p;
  };
}
