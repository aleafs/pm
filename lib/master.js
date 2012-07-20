/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var fs  = require('fs');
var util    = require('util');
var Emitter = require('events').EventEmitter;
var child_process = require('child_process');

var common  = require('./common');
var STATUS  = common.STATUS;
var MESSAGE = common.MESSAGE;
var debug   = common.debug;
var listen  = common.listen;
var MAX_HEARTBEAT_INTERVAL = common.MAX_HEARTBEAT_INTERVAL;

var NOTICE  = function (name, message) {
  debug('master', Array.prototype.join.call(arguments, ' '));
};

var WRITE_STATUS_FILE = function (name, pid, message) {
};

/* {{{ private function _normalize() */
var _normalize  = function (name) {
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
    'max_fatal_restart': 5,
  };
  var groupName = name;

  /* {{{ options rewrite */

  for (var k in options) {
    var value = options[k];
    switch (k) {
      case 'listen':
        _options[k] = Array.isArray(value) ? value : [value];
        break;
      default:
        _options[k] = value;
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
      } catch (e) {
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

    var sub = child_process.fork(_execpath, argv, {
      'cwd' : process.cwd(),
      'env' : process.env,
    });
    var pid = sub.pid;

    _pobject.push(sub);
    _pstatus[pid] = {
      'status'  : STATUS.UNKNOWN,
    };

    NOTICE(util.format('new worker forked (%d) as "%s"', pid, _command));

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
        var now = Date.now();
        if (_fatals.unshift(now) > _options.max_fatal_restart) {
          _fatals = _fatals.slice(0, _options.max_fatal_restart);
        }

        if (_fatals.length >= _options.max_fatal_restart && _fatals[_fatals.length - 1] + 60000 >= now) {
          NOTICE('max fatal restarts (' + _options.max_fatal_restart + ') arrived, give up to fork');

          __GLOBAL_MASTER.emit('giveup', groupName, _fatals.length);
          // after 1 minute, start again
          setTimeout(function () {
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
    var _send = function (type, data, handle, port) {
      try {
        sub.send({
          'type'  : type,
          'data'  : data,
          'port'  : port
        }, handle);
      } catch (e) {
        NOTICE('SEND', e.stack);
      }
    };

    sub.on('message', function (msg) {
      if (!msg || !msg.type) {
        return;
      }

      switch (msg.type) {
        case MESSAGE.GET_FD:
          var _item   = _fdqueue.shift();
          if (!_item) {
            _send(MESSAGE.REQ_FD, 0);
            break;
          }
          var _fd     = _item[1];
          _send(MESSAGE.REQ_FD, _fdqueue.length, _fd, _item[0]);
          _fd.close();
          _fd = null;
          break;

        case MESSAGE.STATUS:
          var pstat = _pstatus[pid] = msg.data;
          pstat._time = Date.now();
          WRITE_STATUS_FILE(groupName, pid, pstat);
          _check_stat_change();
          if (_options.max_request && pstat.scores > _options.max_request) {
            _newChild();
            _tobekill.push(pid);
          }
          break;

        case MESSAGE.RELOAD:
          if (msg.data) {
            var gname = _normalize(msg.data.name || groupName);
            if (__WORKERS_LIST[gname]) {
              __WORKERS_LIST[gname].reload();
            }
          }
          break;

        case MESSAGE.SENDTO:
          if (msg.data && msg.data.name && msg.data.data) {
            var gname = _normalize(msg.data.name);
            if (__WORKERS_LIST[gname]) {
              // TODO: gname or groupName?
              __WORKERS_LIST[gname].accept(msg.data.data, groupName, pid);
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
  var _check_stat_change = function () {
    var _floor  = _options.children / 2;
    var _count  = 0;
    for (var i in _pstatus) {
      var _stat = _pstatus[i];
      if (STATUS.RUNNING === _stat.status /** && _stat._time >= ? */) {
        _count++;
      }
    }
    if (_count !== _running) {
      __GLOBAL_MASTER.emit('state', groupName, _count, _running);
    }

    _running    = _count;
    if (_running >= _floor) {
      _tobekill.forEach(function (pid) {
        process.kill(pid, 'SIGTERM');
      });
      _tobekill   = [];
    }
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
    var now = (new Date()).getTime();
    var die = now - MAX_HEARTBEAT_INTERVAL;
    for (var pid in _pstatus) {
      var _stat = _pstatus[pid];
      if (_stat._time > die) {
        continue;
      }

      if (_stat._time < (now - 2.5 * MAX_HEARTBEAT_INTERVAL)) {
        process.kill(pid, 'SIGKILL');
      } else if (_tobekill.indexOf(pid) < 0) {
        _newChild();
        _tobekill.push(pid);
      }
    }
  }, 5000);

  /* }}} */

  var _me   = {};

  /* {{{ public function start() */
  _me.start = function () {
    _wstatus    = STATUS.PENDING;
    for (var i = _pobject.length; i < _options.children; i++) {
      _newChild();
    }

    var usepush = 2 * _options.children;
    _options.listen.forEach(function (item) {
      if (_listener[item]) {
        return;
      }
      _listener[item] = listen(item, function (handle, port) {
        if (_fdqueue.push([port, handle]) <= usepush) {
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
  _me.stop  = function (callback, signal) {
    _wstatus    = STATUS.STOPING;
    for (var idx in _listener) {
      var _fd = _listener[idx];
      _fd.close();
      _fd = null;
    }
    _listener   = {};
    _killall(signal);

    callback && callback();

    // var _timer1, _timer2;
    // _timer1 = setTimeout(function () {
    //   _killall(signal);
    //   clearInterval(_timer2);
    // }, 1000);

    // _timer2 = setInterval(function () {
    //   if (0 === _fdqueue.length) {
    //     _killall(signal);
    //     clearTimeout(_timer1);
    //     clearInterval(_timer2);
    //   }
    // }, 20);
  };
  /* }}} */

  /* {{{ public function reload() */
  _me.reload = function () {
    for (var pid in _pstatus) {
      _newChild();
      pid = parseInt(pid, 10);
      if (pid) {
        _tobekill.push(pid);
      }
    }
  };
  /* }}} */

  /* {{{ public function accept() */
  _me.accept = function (data, from, pid) {
    _pobject.forEach(function (sub) {
      try {
        sub.send({
          'type' : MESSAGE.COMMAND,
          'data' : data,
          'from' : from,
          'pid'  : pid,
        });
      } catch (e) {
        NOTICE('SEND', e.stack);
      }
    });
  };
  /* }}} */

  return _me;

};

/* {{{ function _createPidFile() */
var _createPidFile = function (fname) {
  var pid = String(process.pid);
  fs.writeFile(fname, pid, function (error) {
    if (error) {
      throw error;
    }
  });

  process.on('exit', function () {
    try {
      if (pid !== fs.readFileSync(fname, 'utf-8').trim()) {
        return;
      }
      fs.unlinkSync(fname);
    } catch (e) {
    }
  });
};
/* }}} */

/* {{{ Master constructor */

var Master = function (options) {
  if (!(this instanceof Master)) {
    return new Master();
  }

  if (options.pidfile) {
    _createPidFile(options.pidfile);
  }

  if (options.statusfile) {
    WRITE_STATUS_FILE = function (name, pid, message) {
      fs.createWriteStream(options.statusfile, {
        flags: 'a+',
        encoding: 'utf-8',
        mode: 0644
      }).end(util.format(
        '%d:\t%s\t%d\t%j\n', process.pid, name, pid, message
      ));
    };

    // XXX: fork
  }

  Emitter.call(this);
};
util.inherits(Master, Emitter);

/* }}} */

var __WORKERS_LIST  = {};
var __GLOBAL_MASTER = null;

/**
 * Register a group of workers.
 * @param {String} name
 * @param {String} file, worker file path.
 * @param {Object} options
 *  - {Array|Number|String} listen, listen port or domain sock, e.g.: `80`, `[80, 8080]` or `[80, '/tmp/web.sock']`.
 *  - {Number} [children], worker number, default is `os.cpu` number.
 *  - {Number} [max_request], max request number per child worker. Dafault is `0`, no limit.
 *  - {Number} [max_fatal_restart], max fatal to giveup restart. Dafault is `5`.
 *  - {Bool} [trace_gc], trace gc, default is `false`.
 * @param {Array} [argv] process start argv.
 * @api public
 */
Master.prototype.register = function (name, file, options, argv) {
  name = _normalize(name);
  if (__WORKERS_LIST[name]) {
    __WORKERS_LIST[name].stop(function () {
    }, 'SIGKILL');
  }

  argv = Array.isArray(argv) ? argv : [];
  argv.unshift(file);

  if (options.trace_gc) {
    argv.unshift('--trace_gc');
    delete options.trace_gc;
  }

  __WORKERS_LIST[name] = _workerPair(argv, options, name);
  return this;
};

Master.prototype.shutdown = function (callback, signal, name) {
  if (name) {
    if (__WORKERS_LIST[name]) {
      __WORKERS_LIST[name].stop(callback, signal);
    } else {
      callback && callback();
    }
  } else {
    for (var k in __WORKERS_LIST) {
      __WORKERS_LIST[k].stop(null, signal);
    }
    callback && callback();
  }
  return this;
};

Master.prototype.reload = function (name) {
  if (name) {
    if (__WORKERS_LIST[name]) {
      __WORKERS_LIST[name].reload();
    }
  } else {
    for (var k in __WORKERS_LIST) {
      __WORKERS_LIST[k].reload();
    }
  }
  return this;
};

Master.prototype.dispatch = function () {
  for (var name in __WORKERS_LIST) {
    __WORKERS_LIST[name].start();
  }
  return this;
};

exports.create  = function (options) {

  if (!__GLOBAL_MASTER) {
    __GLOBAL_MASTER = new Master(options);

    process.on('SIGHUB',  function () {});
    process.on('exit',    function () {
      NOTICE('About to exit ...');
      __GLOBAL_MASTER.shutdown(function () {
        NOTICE('SIGKILL exited');
      }, 'SIGKILL');
    });

    process.on('SIGTERM', function () {
      NOTICE('Got SIGTERM, about to exit...');
      __GLOBAL_MASTER.shutdown(function () {
        NOTICE('SIGTERM exited');
      });
    });

    process.on('SIGUSR1', function () {
      NOTICE('Got SIGUSR1, about to reload...');
      __GLOBAL_MASTER.reload();
    });
  }

  return __GLOBAL_MASTER;

};

