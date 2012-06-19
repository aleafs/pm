/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var STATUS  = require(__dirname + '/common.js').STATUS;
var MESSAGE = require(__dirname + '/common.js').MESSAGE;
var Debug   = require(__dirname + '/common.js').debug;
var Listen  = require(__dirname + '/common.js').listen;

var NOTICE  = function(name, message) {
  Debug('master', Array.prototype.join.call(arguments, ' '));
};

/* {{{ private function _normalize() */
var _normalize  = function(name) {
  return name.toString().trim().toLowerCase();
};
/* }}} */

var _workerPair = function(file, options, argv, master) {

  argv  = Array.isArray(argv) ? argv : [];
  argv.unshift(file);

  /* {{{ _fork() */
  /**
   * fork a new child process
   * @return {Object} child_process
   */
  var _fork = function () {
    var sub = require('child_process').fork('--trace_gc', argv, {
      'cwd' : process.cwd(),
        'env' : process.env,
    });
    var pid = sub.pid;

    NOTICE('new worker forked (' + pid + ') as "' + file + '"');

    _pobject.push(sub);
    _pstatus[pid]   = {
      'status'  : STATUS.UNKNOWN,
    };

    var rpc = function(type, data, handle) {
      try {
        sub.send({
          'type'  : type,
          'data'  : data,
        }, handle);
      } catch(e) {
        NOTICE('SEND', e.toString());
      }
    };

    /**
     * @on message
     */
    /* {{{ */
    sub.on('message', function(msg) {
      if (!msg.type) {
        return;
      }

      switch (msg.type) {
        case MESSAGE.GET_FD:
          var _fd   = _fdqueue.shift();
          rpc(MESSAGE.REQ_FD, _fdqueue.length, _fd);
          if (_fd) {
            _fd.close();
            _fd = null;
          }
          break;

        case MESSAGE.STATUS:
          var _stat = _pstatus[pid] ? _pstatus[pid].status : -1;
          _pstatus[pid] = msg.data;
          if (_stat !== _pstatus[pid].status) {
            _trigger();
          }
          if (_options.max_request && _pstatus[pid].scores > _options.max_request) {
            _fork();
            _tobekill.push(pid);
          }
          break;

        case MESSAGE.RELOAD:
          if (msg.data && msg.data.name) {
            master.reload(msg.data.name);
          }
          break;

        case MESSAGE.SENDTO:
          if (msg.data.name) {
            master.sendto(msg.data.name, msg.data.data);
          }
          break;

        default:
          break;
      }
    });
    /* }}} */

    /**
     * @on exit
     */
    /* {{{ */
    sub.on('exit', function(code, signal) {
      var _objects  = [];
      _pobject.forEach(function(item) {
        if (item.pid !== pid) {
          _objects.push(item);
        }
      });
      _pobject  = _objects;
      delete _pstatus[pid];

      if (STATUS.STOPING === _wstatus) {
        return;
      }

      if (code && 'SIGKILL' !== signal) {
        var now = (new Date()).getTime();
        if (_fatals.unshift(now) > _options.max_fatal_restart) {
          _fatals = _fatals.slice(0, _options.max_fatal_restart);
        }

        if (_fatals.length >= _options.max_fatal_restart) {
          var s = _fatals.pop();
          if (s + 1000 * _options.restart_time_window >= now) {
            NOTICE('max fatal restarts (' + _options.max_fatal_restart + ') arrived, give up to fork');

            // XXX: emit giveup event
            setTimeout(function() {
              _me.start();
            }, _options.restart_time_window * 1000);
            return;
          }
          _fatals.push(s);
        }
      }

      _me.start();
    });
    /* }}} */

    return sub;
  };
  /* }}} */

  /* {{{ _options  */

  var _options  = {
    'listen'      : [],
    'children'    : require('os').cpus().length,
    'max_request' : 0,
    'max_fatal_restart'     : 5,
    'restart_time_window'   : 60,
  };
  for (var i in options) {
    switch (i) {
      case 'listen':
        _options[i] = Array.isArray(options[i]) ? options[i] : options[i].toString().split(',');
        break;
      default:
        _options[i] = options[i];
        break;
    }
  }

  /* }}} */

  /**
   * @connection queue
   */
  var _fdqueue  = [];

  /**
   * @process status
   */
  var _pstatus  = {};
  var _running  = 0;

  /* {{{ */
  var _trigger  = function() {
    var _floor  = _options.children / 2;
    var _count  = 0;
    for (var i in _pstatus) {
      var _stat = _pstatus[i];
      if (STATUS.RUNNING === _stat.status /** && _stat._time >= ? */) {
        _count++;
      }
    }
    if (_count !== _running) {
      // emit change
    }

    if (_count >= _floor) {
      _tobekill.forEach(function(pid) {
        process.kill(pid, 'SIGTERM');
      });
      _tobekill   = [];
      if (_running < _floor) {
        NOTICE('--OK--', 'more than ' + _floor + ' workers is running');
      }
    }
    _running    = _count;
  };
  /* }}} */

  /**
   * @process object
   */
  var _wakeups  = 0;
  var _pobject  = [];
  var _killall  = function(signal) {
    _pobject.forEach(function(sub) {
      try {
        sub.kill(signal || 'SIGTERM');
      } catch(e) {
      }
    });
    _pobject    = [];
  };

  /**
   * @to be killed process
   */
  var _tobekill = [];

  /**
   * @ fatal restarts
   */
  var _fatals   = [];

  /**
   * @listeners
   */
  var _listener = {};

  /**
   * @worker status
   */
  var _wstatus  = STATUS.PENDING;

  /**
   * @timer to check heartbeat
   */
  /* {{{ */
  var _timer    = setInterval(function() {
    var _expire = (new Date()).getTime() - 30 * 1000;
    for (var pid in _pstatus) {
      var _stat = _pstatus[pid];
      if (_stat._time < _expire) {
        _fork();
        _tobekill.push(pid);
      }
    }
  }, 2000);

  /* }}} */

  var _me   = {};

  /* {{{ public function start() */
  _me.start = function() {
    _wstatus    = STATUS.PENDING;
    for (var i = _pobject.length; i < _options.children; i++) {
      _fork();
    }

    var usepush = 2 * _options.children;
    _options.listen.forEach(function(item) {
      if (_listener[item]) {
        return;
      }
      _listener[item] = Listen(item, function(handle) {
        if (_fdqueue.push(handle) <= usepush) {
          _wakeups = (_wakeups + 1) % _pobject.length;
          try {
            _pobject[_wakeups].send({
              'type'  : MESSAGE.WAKEUP,
            });
          } catch (e) {
          }
        }
      });
    });
  };
  _me.start();
  /* }}} */

  /* {{{ public function stop() */
  /**
   * stop worker process
   */
  _me.stop  = function(signal) {
    _wstatus    = STATUS.STOPING;
    for (var idx in _listener) {
      var _fd = _listener[idx];
      _fd.close();
      _fd = null;
    }
    _listener   = {};
    _killall(signal);
    return;
    var _timer1 = setTimeout(function() {
      _killall(signal);
      clearInterval(_timer2);
    }, 1000);

    var _timer2 = setInterval(function() {
      if (0 === _fdqueue.length) {
        _killall(signal);
        clearTimeout(_timer1);
        clearInterval(_timer2);
      }
    }, 20);
  };
  /* }}} */

  /* {{{ public function accept() */
  _me.accept = function(data) {
    _pobject.forEach(function(sub) {
      try {
        sub.send({
          'type' : MESSAGE.COMMAND,
          'data' : data,
        });
      } catch(e) {
        NOTICE('SEND', e.toString());
      }
    });
  };
  /* }}} */

  /* {{{ public function reload() */
  _me.reload = function() {
    for (var pid in _pstatus) {
      _fork();
      _tobekill.push(pid);
    }
  };
  /* }}} */

  return _me;

};

exports.create  = function(options) {

  /**
   * @master参数
   */
  /* {{{ */
  var _options  = {
    'pidfile'   : null,
  };
  for (var i in options) {
    _options[i] = options[i];
  }
  if (_options.pidfile) {
    var fs  = require('fs');
    fs.writeFile(_options.pidfile, process.pid, function(error) {
      if (error) {
        throw error;
      }
      process.on('exit', function() {
        fs.readFile(_options.pidfile, 'utf-8', function(error, data) {
          if (process.pid == data.trim()) {
            fs.unlink(_options.pidfile, function(error) {
            });
          }
        });
      });
    });
  }
  /* }}} */

  /**
   * @worker列表
   */
  var _workers  = {};

  var _me   = {};

  /* {{{ public function register() */
  _me.register  = function(name, file, options, argv) {
    var sub = _workerPair(file, options, argv, _me);
    _workers[_normalize(name)]  = sub;
    return sub;
  };
  /* }}} */

  /* {{{ public function shutdown() */
  _me.shutdown  = function(idx, signal) {
    for (var i in _workers) {
      if (!idx || i === idx) {
        _workers[i].stop(signal);
      }
    }
  };
  /* }}} */

  /* {{{ public function reload() */
  _me.reload    = function(idx) {
    for (var i in _workers) {
      if (!idx || i === idx) {
        _workers[i].reload();
      }
    }
  };
  /* }}} */

  /* {{{ public function sendto() */
  _me.sendto    = function(idx, data) {
    idx = _normalize(idx);
    if (_workers[idx]) {
      _workers[idx].accept(data);
    }
  };
  /* }}} */

  /* {{{ public function dispatch() */
  _me.dispatch  = function() {
    for (var idx in _workers) {
      _workers[idx].start();
    }
  };
  /* }}} */

  /**
   * @process signal handles
   */
  /* {{{ */
  process.on('SIGHUB',  function() {});
  process.on('exit',    function() {
    NOTICE('About to exit ...');
    _me.shutdown(null, 'SIGKILL');
  });

  process.on('SIGTERM', function() {
    NOTICE('Got SIGTERM, about to exit...');
    _me.shutdown();
  });

  process.on('SIGUSR1', function() {
    NOTICE('Got SIGUSR1, about to reload...');
    _me.reload();
  });
  /* }}} */

  return _me;

};

