/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Util    = require('util');
var Emitter = require('events').EventEmitter;

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

var _workerPair = function (argv, options, name) {

  /**
   * @ _options
   */
  var _options  = {
    'listen'      : [],
    'children'    : require('os').cpus().length,
    'max_request' : 0,
    'max_fatal_restart'     : 5,
  };

  /* {{{ options rewrite */

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
   * @ 请求队列
   */
  var _fdqueue  = [];

  /**
   * @ 子进程列表
   */
  var _pobject  = [];

  /**
   * @ 子进程状态
   */
  var _pstatus  = {};

  var _killall  = function (signal) {
    _pobject.forEach(function (sub) {
      try {
        sub.kill(signal || 'SIGTERM');
      } catch(e) {
      }
    });
    _pobject    = [];
  };

  /**
   * @ fatal restarts
   */
  var _fatals   = [];

  /* {{{ function _newChild() */
  /**
   * fork a new child process
   * @return {Object} child_process
   */
  var _command  = argv.join(' ');
  var _execpath = argv.shift();
  var _newChild = function () {

    var sub = require('child_process').fork(_execpath, argv, {
      'cwd' : process.cwd(),
        'env' : process.env,
    });
    var pid = sub.pid;

    _pobject.push(sub);
    _pstatus[pid] = {
      'status'  : STATUS.UNKNOWN,
    };

    NOTICE(Util.format('new worker forked (%d) as "%s"', pid, _command));

    /**
     * @ on exit
     */
    /* {{{ */
    sub.on('exit', function (code, signal) {
      var _objects  = [];
      _pobject.forEach(function (item) {
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

        if (_fatals.length >= _options.max_fatal_restart && _fatals[_fatals.length - 1] + 60000 >= now) {
          NOTICE('max fatal restarts (' + _options.max_fatal_restart + ') arrived, give up to fork');

          __GLOBAL_MASTER.emit('giveup', name, _fatals.length);
          setTimeout(function() {
            _me.start();
          }, 60100);

          return;
        }
      }
      _me.start();
    });
    /* }}} */

    /**
     * @on message
     */
    /* {{{ */
    var _send = function (type, data, handle) {
      try {
        sub.send({
          'type'  : type,
          'data'  : data,
        }, handle);
      } catch(e) {
        NOTICE('SEND', e.stack);
      }
    };

    sub.on('message', function (msg) {
      if (!msg.type) {
        return;
      }

      switch (msg.type) {
        case MESSAGE.GET_FD:
          var _fd   = _fdqueue.shift();
          _send(MESSAGE.REQ_FD, _fdqueue.length, _fd);
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
            _newChild();
            _tobekill.push(pid);
          }
          break;

        case MESSAGE.RELOAD:
          if (msg.data) {
            var idx = _normalize(msg.data.name || name);
            if (__WORKERS_LIST[idx]) {
              __WORKERS_LIST[idx].reload();
            }
          }
          break;

        case MESSAGE.SENDTO:
          if (msg.data && msg.data.name && msg.data.data) {
            var idx = _normalize(msg.data.name);
            if (__WORKERS_LIST[idx]) {
              __WORKERS_LIST[idx].accept(msg.data.data, name, pid);
            }
          }
          break;

        default:
          break;
      }
    });
    /* }}} */

    return sub;

  };
  /* }}} */

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

  /**
   * @to be killed process
   */
  var _tobekill = [];

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
  var _timer    = setInterval(function () {
    var _expire = (new Date()).getTime() - 30 * 1000;
    for (var pid in _pstatus) {
      var _stat = _pstatus[pid];
      if (_stat._time < _expire) {
        _newChild();
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
      _newChild();
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

    //XXX:
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

  /* {{{ public function reload() */
  _me.reload = function() {
    for (var pid in _pstatus) {
      _newChild();
      _tobekill.push(pid);
    }
  };
  /* }}} */

  /* {{{ public function accept() */
  _me.accept = function(data, from, pid) {
    _pobject.forEach(function (sub) {
      try {
        sub.send({
          'type' : MESSAGE.COMMAND,
          'data' : data,
          'from' : from,
          'pid'  : pid,
        });
      } catch(e) {
        NOTICE('SEND', e.stack);
      }
    });
  };
  /* }}} */

  return _me;

};

/* {{{ Master constructor */

var _Master = function (options) {
  if (!(this instanceof _Master)) {
    return new _Master();
  }

  if (options.pidfile) {
    var fs  = require('fs');
    var pid = process.pid;
    fs.writeFile(options.pidfile, pid, function (error) {
      if (error) {
        throw error;
      }
    });

    process.on('exit', function () {
      fs.readFile(options.pidfile, 'utf-8', function (error, data) {
        if (error || pid != data.trim()) {
          return;
        }

        fs.unlink(options.pidfile, function (error) {
        });
      });
    });
  }

  Emitter.call(this);
};
Util.inherits(_Master, Emitter);

/* }}} */

var __WORKERS_LIST  = {};
var __GLOBAL_MASTER = null;

_Master.prototype.register = function (name, file, options, argv) {
  name = _normalize(name);
  if (__WORKERS_LIST[name]) {
    __WORKERS_LIST[name].stop();
  }

  argv = Array.isArray(argv) ? argv : [];
  argv.unshift(file);

  if (options.trace_gc) {
    argv.unshift('--trace_gc');
    delete options.trace_gc;
  }

  __WORKERS_LIST[name] = _workerPair(argv, options, name);
};

_Master.prototype.shutdown = function (idx, signal) {
  for (var i in __WORKERS_LIST) {
    if (!idx || i === idx) {
      __WORKERS_LIST[i].stop(signal);
    }
  }
};

_Master.prototype.reload = function (idx) {
  for (var i in __WORKERS_LIST) {
    if (!idx || i === idx) {
      __WORKERS_LIST[i].reload();
    }
  }
};

_Master.prototype.dispatch = function () {
  for (var i in __WORKERS_LIST) {
    __WORKERS_LIST[i].start();
  }
};

exports.create  = function(options) {

  if (!(__GLOBAL_MASTER instanceof _Master)) {
    __GLOBAL_MASTER = new _Master(options);

    process.on('SIGHUB',  function() {});
    process.on('exit',    function() {
      NOTICE('About to exit ...');
      __GLOBAL_MASTER.shutdown(undefined, 'SIGKILL');
    });

    process.on('SIGTERM', function() {
      NOTICE('Got SIGTERM, about to exit...');
      __GLOBAL_MASTER.shutdown();
    });

    process.on('SIGUSR1', function() {
      NOTICE('Got SIGUSR1, about to reload...');
      __GLOBAL_MASTER.reload();
    });
  }

  return __GLOBAL_MASTER;

};

