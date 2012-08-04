/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

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
    'max_request' : 0,
    'max_fatal_restart' : 5,        /**<    异常退出重启次数    */
    'max_heartbeat_lost': -1,       /**<    僵死进程判断阈值    */
  };
  var groupName = name;

  /* {{{ options rewrite */

  for (var k in options) {
    _options[k] = options[k];
  }
  if (!_options.children) {
    _options.children = require('os').cpus().length;
  }
  if (!_options.listen) {
    _options.listen = [];
  } else if (!Array.isArray(_options.listen)) {
    _options.listen = _options.listen.toString().split(',');
  }
  /* }}} */

  /**
   * @ 请求计数器
   */
  var _reqnum   = 0;

  /**
   * @ 活动子进程
   */
  var _palive   = [];

  /**
   * @ 所有子进程
   */
  var _allproc  = [];

  /**
   * @ 子进程列表
   */
  var _pobject  = {};

  /**
   * @ 子进程状态
   */
  var _pstatus  = {};

  /**
   * @ 心跳间隔
   */
  var _hbtime   = MAX_HEARTBEAT_INTERVAL;

  var _killall  = function (signal) {
    for (var pid in _pobject) {
      try {
        process.kill(pid, signal || 'SIGTERM');
      } catch (e) {
      }
    }
    _pobject = {};
    _pstatus = {};
    _allproc = [];
    _palive  = [];
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

    _allproc.push(pid);
    _pobject[pid] = sub;
    _pstatus[pid] = {
      'status'  : STATUS.UNKNOWN,
    };

    NOTICE(util.format('new worker forked (%d) as "%s"', pid, _command));

    /**
     * @ on exit
     */
    /* {{{ */
    sub.on('exit', function (code, signal) {
      delete _pobject[pid];
      delete _pstatus[pid];

      _allproc = [];
      _palive  = [];
      for (var i in _pobject) {
        _allproc.push(i);
        if (STATUS.RUNNING === _pstatus[i]) {
          _palive.push(i);
        }
      }

      if (STATUS.STOPING === _wstatus) {
        return;
      }

      if (code || 'SIGKILL' === signal) {
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
        case MESSAGE.STATUS:
          var now   = Date.now();
          var pstat = _pstatus[pid] || {};
          if (pstat && pstat._time) {
            _hbtime = Math.min(_hbtime, now - pstat._time);
          }
          for (var i in msg.data) {
            pstat[i] = msg.data[i];
          }
          pstat._time = now;
          _pstatus[pid] = pstat;
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

  /* {{{ */
  var _check_stat_change = function () {

    _palive = [];
    var die = Date.now() - 1.5 * _hbtime;
    for (var i in _pstatus) {
      var pstat = _pstatus[i];
      if (STATUS.RUNNING === pstat.status && pstat._time >= die) {
        _palive.push(i);
      }
    }

    if (_palive.length >= (_options.children / 2)) {
      _tobekill.forEach(function (pid) {
        process.kill(pid, 'SIGTERM');
      });
      _tobekill = [];
    }
  };
  /* }}} */

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

  _options.max_heartbeat_lost && setInterval(function () {
    var die = Date.now();
    if (options.max_heartbeat_lost < 0) {
      die -= (2 * MAX_HEARTBEAT_INTERVAL);
    } else {
      die -= (options.max_heartbeat_lost * _hbtime);
    }
    for (var pid in _pstatus) {
      var pstat = _pstatus[pid];
      if (pstat._time < die) {
        NOTICE('[' + pid + '] maybe already been dead, killing ... ');
        process.kill(pid, 'SIGKILL');
      }
    }
  }, 5000);

  var _me   = {};

  /* {{{ public function start() */
  _me.start = function () {
    _wstatus    = STATUS.PENDING;
    for (var i = _allproc.length; i < _options.children; i++) {
      _newChild();
    }

    _options.listen.forEach(function (item) {
      if (_listener[item]) {
        return;
      }
      _listener[item] = listen(item, function (handle, port) {
        var idx = _palive.length ? _palive[_reqnum % _palive.length] : _allproc[_reqnum % _allproc.length];
        try {
          _pobject[idx].send({'type' : MESSAGE.REQ_FD, 'port' : port}, handle);
        } catch (e) {
        }

        _reqnum++;

        handle.close();
        handle = null;
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
    for (var i in _pobject) {
      try {
        _pobject[i].send({
          'type' : MESSAGE.COMMAND,
          'data' : data,
          'from' : from,
          'pid'  : pid,
        });
      } catch (e) {
        NOTICE('SEND', e.stack);
      }
    }
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

  if (options && options.pidfile) {
    _createPidFile(options.pidfile);
  }

  if (options && options.statusfile) {
    WRITE_STATUS_FILE = function (name, pid, message) {
      fs.createWriteStream(options.statusfile, {
        flags: 'a+',
        encoding: 'utf-8',
        mode: 420   // 0644
      }).end(util.format(
          '%d:\t%s\t%d\t%j\n', process.pid, name, pid, message));
    };
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

