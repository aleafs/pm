/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var util = require('util');
var fork = require('child_process').fork;
var CPUS = require('os').cpus().length;

var Handle = require(__dirname + '/common.js').getHandle;
var Emitter = require('events').EventEmitter;

/**
 * @ 重新定义全局变量，便于单元测试mock
 */
var PROCESS = process;

/* {{{ private function _extend() */
var _extend = function (a, b) {
  var a = a || {};
  for (var i in b) {
    a[i] = b[i];
  }
  return a;
};
/* }}} */

var MessageHandle = {};
MessageHandle.heartbeat = function (owner, pid, data) {
  owner.pstatus[pid] = _extend(_extend(owner.pstatus[pid], data), {
    '_time' : Date.now()
  });
};

MessageHandle.broadcast = function (owner, pid, data) {
  if (!data || !data.msg) {
    return;
  }
  owner.emit('broadcast', data.who, data.msg, pid);
};

exports.create = function (argv, options) {

  /* {{{ _options */
  var _options = _extend({
    'listen'   : [],
    'children' : CPUS,
    'max_fatal_restart' : 5,
    'pause_after_fatal' : 60000,
    'max_heartbeat_lost' : -1
  }, options);

  if (!_options.listen) {
    _options.listen = [];
  } else if (!Array.isArray(_options.listen)) {
    _options.listen = _options.listen.toString().split(',');
  }
  _options.listen.map(function (i) {
    return Number(i) || i;
  });
  /* }}} */

  var Child = function () {
    Emitter.call(this);

    /**
     * @ 运行状态
     */
    this.running = 1;

    /**
     * @ 进程状态表
     */
    this.pstatus = {};

    /**
     * @ 即将消亡的进程列表
     */
    this.dielist = {};

    /**
     * @ 异常退出
     */
    this.pfatals = [];

  };
  util.inherits(Child, Emitter);

  /**
   * @ 监听句柄
   */
  var handles = {};
  var getHandle = function (i) {
    if (!handles[i]) {
      handles[i] = Handle(i);
    }
    return handles[i];
  };

  /**
   * @ childress list
   */
  var workers = {};

  var command = argv.join(' ');
  var exepath = argv.shift();

  /* {{{ private prototype _fork() */
  Child.prototype._fork = function () {
    var _self = this;
    var sub = fork(exepath, argv, {
      'cwd' : PROCESS.cwd(), 'env' : _extend({}, PROCESS.env)
    });

    var pid = sub.pid;
    workers[pid] = sub;
    _self.pstatus[pid] = {
      'uptime' : Date.now(),
    };
    _self.emit('fork', pid);

    sub.on('exit', function (code, signal) {
      delete workers[pid];
      delete _self.pstatus[pid];
      delete _self.dielist[pid];
      _self.emit('exit', pid, code, signal);

      if (!_self.running) {
        return;
      }

      if (code || 'SIGKILL' === signal) {
        var t = Date.now();
        var n = _self.pfatals.unshift(t);
        var p = _options.pause_after_fatal;
        if (n > _options.max_fatal_restart) {
          _self.pfatals = _self.pfatals.slice(0, _options.max_fatal_restart);
        }

        n = _self.pfatals.length;
        if (n >= _options.max_fatal_restart && _self.pfatals[n - 1] + ~~(0.9 * p) >= t) {
          _self.emit('giveup', n, p);
          setTimeout(function () {
            _self.start();
          }, p);
          return;
        }
      }
      _self.start();
    });

    sub.on('message', function (msg) {
      if (!msg || !msg.type) {
        return;
      }

      if ('ready' === msg.type) {
        _options.listen.forEach(function (i) {
          if (!i) {
            return;
          }
          try {
            sub.send('listen', i, getHandle(i));
          } catch (e) {
          }
        });
        for (var i in _self.dielist) {
          if (workers[i]) {
            workers[i].kill('SIGTERM');
            break;
          }
        }
      } else if ('function' === (typeof MessageHandle[msg.type])) {
        (MessageHandle[msg.type])(_self, pid, msg.data);
      }
    });

    return sub;
  };
  /* }}} */

  /* {{{ public prototype start() */
  Child.prototype.start = function () {
    var n = 0;

    var _self = this;
    Object.keys(workers).forEach(function (i) {
      if (!_self.dielist[i]) {
        n++;
      }
    });

    while (n < _options.children) {
      _self._fork();
      n++;
    }
  };
  /* }}} */

  /* {{{ public prototype stop() */
  Child.prototype.stop  = function (signal) {
    var _self = this;
    _self.running = 0;

    Object.keys(handles).forEach(function (i) {
      handles[i].close();
      delete handles[i];
    });

    Object.keys(workers).forEach(function (i) {
      workers[i].kill(signal || 'SIGTERM');
    });

    Object.keys(_self.dielist).forEach(function (i) {
      if (workers[i]) {
        workers[i].kill(signal || 'SIGTERM');
      }
    });
  };
  /* }}} */

  /* {{{ public prototype reload() */
  Child.prototype.reload = function () {
    var _self = this;
    Object.keys(workers).forEach(function (i) {
      _self.dielist[i] = true;
    });
    _self.start();
  };
  /* }}} */

  /* {{{ public prototype broadcast() */
  Child.prototype.broadcast = function (msg, from, pid) {
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

  return new Child();

};

