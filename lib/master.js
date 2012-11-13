/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var fs = require('fs');
var path = require('path');
var util = require('util');
var fork = require('child_process').fork;

var Emitter = require('events').EventEmitter;

var TCP  = process.binding('tcp_wrap').TCP;
var Pipe = process.binding('pipe_wrap').Pipe;

/**
 * 全局master对象
 */
var __GLOBAL_MASTER = null;

var WRITE_STATUS_FILE = function () {};

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

/* {{{ private function _extend() */
var _extend = function (a, b) {
  var a = a || {};
  for (var i in b) {
    a[i] = b[i];
  }
  return a;
};
/* }}} */

/* {{{ private function _Handle() */
var _Handle = function (idx) {
  var h = null;
  var r = 0;

  idx = Number(idx) || idx;
  if (idx instanceof Number) {
    h = new TCP();
    r = h.bind('0.0.0.0', idx);
  } else {
    h = new Pipe();
    r = h.bind(idx);
  }

  if (r) {
    h.close();
    h = null;
  }

  return h;
};
/* }}} */

var ProcessPool = function (argv, options, GNAME) {

  /* {{{ _options */
  var _options = _extend({
    'listen'   : [],
      'children' : 0,
      'max_fatal_restart'  : 5,
      'max_heartbeat_lost' : -1
  }, options);

  if (!options.children) {
    _options.children = require('os').cpus().length;
  }
  if (!_options.listen) {
    _options.listen = [];
  } else if (!Array.isArray(_options.listen)) {
    _options.listen = _options.listen.toString().split(',');
  }
  _options.listen.map(function (i) {
    return Number(i) || i;
  });
  /* }}} */

  /**
   * @ 监听句柄
   */
  var handles = {};
  var getHandle = function (idx) {
    if (!handles[idx]) {
      handles[idx] = _Handle(idx);
    }
    return handles[idx];
  };

  /**
   * @ 运行状态
   */
  var running = 0;

  /**
   * @ 进程状态表
   */
  var pstatus = {};

  /**
   * @ 即将消亡的进程列表
   */
  var dielist = [];

  /**
   * @ 异常退出
   */
  var pfatals = [];

  var command = argv.join(' ');
  var exepath = argv.shift();

  /* {{{ private function _fork() */
  var _fork = function () {
    var sub = fork(exepath, argv, {
      'cwd' : process.cwd(),
        'env' : _extend({}, process.env)
    });

    var pid = sub.pid;
    workers[pid] = sub;
    pstatus[pid] = {
      'uptime' : Date.now(),
    };

    /* {{{ private function _send() */
    var _send = function (type, data, handle) {
      try {
        sub.send({'type' : type, 'data' : data}, handle);
      } catch (e) {
      }
    };
    /* }}} */

    sub.on('exit', function (code, signal) {
      delete workers[pid];
      delete pstatus[pid];
      if (!running) {
        return;
      }

      /* {{{ 非正常退出 */

      if (code || 'SIGKILL' === signal) {
        var now = Date.now();
        if (pfatals.unshift(now) > _options.max_fatal_restart) {
          pfatals = pfatals.slice(0, _options.max_fatal_restart);
        }
        if (pfatals.length >= _options.max_fatal_restart && 
          pfatals[pfatals.length - 1] + 60000 >= now) {
          __GLOBAL_MASTER.emit('giveup', GNAME, pfatals.length);
          setTimeout(_fork, 60100);
          return;
        }
      }
      /* }}} */

      _fork();
    });

    sub.on('message', function (msg) {

      /* {{{ gethandle */
      if ('gethandle' === msg.type) {
        _options.listen.forEach(function (i) {
          _send('listen', i, getHandle(i));
        });

        var die = 0;
        while (dielist.length > 0) {
          die = dielist.pop();
          if (workers[die]) {
            process.kill(die, 'SIGTERM');
            break;
          }
        }
        return;
      }
      /* }}} */

      if ('heartbeat' === msg.type) {
        pstatus = _extend(_extend(pstatus, msg.data), {
          '_time' : Date.now()
        });
        return;
      }

      if ('broadcast' === msg.type) {
        var m = msg.data;
        if (m && m.who) {
          __GLOBAL_MASTER.broadcast(m.who, m.msg, GNAME, pid);
        }
        return;
      }
    });
  };
  /* }}} */

  /* {{{ private function start() */
  var start = function () {
    for (var i = 0; i < _options.length; i++) {
      _fork();
    }
  };
  /* }}} */

  start();

  var _me = {};

  /* {{{ public function broadcast() */
  _me.broadcast = function (msg, from, pid) {
    Object.keys(workers).forEach(function (i) {
      try {
        workers[i].send({
          'type' : 'hello',
          'data' : msg,
          'from' : from,
          '_pid' : pid
        });
      } catch (e) {
      }
    });
  };
  /* }}} */

  /* {{{ public function stop() */
  _me.stop = function () {
    running = 0;
    Object.keys(workers).forEach(function (i) {
      process.kill(i, 'SIGTERM');
    });
    dielist.forEach(function (i) {
      process.kill(i, 'SIGTERM');
    });
  };
  /* }}} */

  /* {{{ public function reload() */
  _me.reload = function () {
    dielist.forEach(function (i) {
      process.kill(i, 'SIGTERM');
    });
    dielist = Object.keys(workers);
    start();
  };
  /* }}} */

  return _me;
};

var NOTICE  = function () {
  console.log('[master:%d][%s] %s', process.pid, (new Date()), 
      Array.prototype.join.call(arguments, ' '));
};

/* {{{ private function _writePidFile() */
var _writePidFile = function (fn) {
  mkdir(path.dirname(fn));
  fs.writeFileSync(fn, process.pid);
  process.on('exit', function () {
    try {
      var pid = fs.readFileSync(fn, 'utf8');
      if (Number(pid) === process.pid) {
        fs.unlinkSync(fn);
      }
    } catch (e) {
    }
  });
};
/* }}} */

/* {{{ public Master constructor() */

var Master  = function (options) {

  Emitter.call(this);

  var _options = _extend({
    'pidfile' : '',
      'statusfile' : '',
  }, options);

  _options.pidfile && _writePidFile(_options.pidfile);
  if (_options.statusfile) {
    mkdir(path.dirname(_options.statusfile));
    WRITE_STATUS_FILE = function (name, pid, data) {
      fs.createWriteStream(_options.statusfile, {
        flags: 'a+',
        encoding: 'utf8',
        mode: 420   // 0644
      }).end(util.format(
          '%d:\t%s\t%d\t%j\n', process.pid, name, pid, data));
    };
  }
};
util.inherits(Master, Emitter);

/* }}} */

/* {{{ public prototype setLogger() */
Master.prototype.setLogger = function (logger) {
  NOTICE = logger;
};
/* }}} */

Master.prototype.register = function (name, file, options, argv) {
};

Master.prototype.reload = function (who) {
};

Master.prototype.dispatch = function () {
};

exports.create = function (options) {
  if (!(__GLOBAL_MASTER instanceof Master)) {
    __GLOBAL_MASTER = new Master(options);
  }

  return __GLOBAL_MASTER;
};

