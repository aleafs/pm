/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var util = require('util');
var child_process = require('child_process');
var CPUS = require(__dirname + '/os.js').cpusnum();

var Handle = require(__dirname + '/common.js').getHandle;
var Emitter = require('events').EventEmitter;

/**
 * @ 重新定义全局变量，便于单元测试mock
 */
var PROCESS = process;

/* {{{ private function _extend() */
var _extend = function (a, b) {
  a = a || {};
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
  owner.emit('broadcast', data.who, data.msg, pid, data.pid);
};

MessageHandle.disconnect = function (owner, pid, data) {
  owner.emit('disconnect', pid, data);
};

exports.create = function (argv, options) {

  /* {{{ _options */
  var _options = _extend({
    'listen'   : [],
    'children' : CPUS,
    'max_fatal_restart' : 5,
    'pause_after_fatal' : 60000,
    'max_heartbeat_lost' : -1,
    'use_serial_mode' : false
  }, options);

  if (!_options.children) {
    _options.children = CPUS;
  }
  if (!_options.listen) {
    _options.listen = [];
  } else if (!Array.isArray(_options.listen)) {
    _options.listen = _options.listen.toString().split(',').filter(function (a) { return a; });
  }
  _options.listen = _options.listen.map(function (i) {
    return /^\d+$/.test(i) ? Number(i) : i;
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
     * @ 正常进程数
     */
    this.okcount = 0;

    /**
     * @ 即将消亡的进程列表
     */
    this.dielist = {};

    /**
     * @ 异常退出
     */
    this.pfatals = [];

    /**
     * @ 串行启动模式下的获得令牌的进程id及分配过的令牌次数
     */
    if (_options.use_serial_mode) {
      this.tokenPid = -1;
      this.tokenCount = 0;
    }

    /**
     * 总共 fork 过的进程数
     * @type {Number}
     */
    this._forkCount = 0;
    
  };
  util.inherits(Child, Emitter);

  /**
   * @ 监听句柄
   */
  var handles = {};
  var getHandle = function (i, addr) {
    if (!handles[i]) {
      handles[i] = Handle(i, addr);
    }
    return handles[i];
  };

  /**
   * @ childress list
   */
  var workers = {};

  var command = argv.join(' ');
  var exepath = argv.shift();

  Child.prototype.fork = function() {
    var sub = this._fork();
    return {
      process: sub
    };
  };

  /* {{{ private prototype _fork() */
  Child.prototype._fork = function () {
    var _self = this;
    var sub = child_process.fork(exepath, argv, {
      'cwd' : PROCESS.cwd(), 
      'env' : _extend({
        PM_WORKER_INDEX: _self._forkCount++
      }, PROCESS.env)
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

      _self.okcount = Math.max(0, _self.okcount - 1);
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
      
      // 串行启动模式下发送令牌后，子进程异常退出的情况
      if (_options.use_serial_mode && _self.tokenPid === pid) {
        _self.tokenPid = -1;
      }

      _self.start();
    });
    
    sub.on('message', function (msg) {
      //并行启动的令牌发放及回收操作
      if (_options.use_serial_mode) {
        if (msg.cmd === 'token_get') {
          try{
            if (_self.tokenPid === -1) {
              sub.send({ token : ++_self.tokenCount });
              _self.tokenPid = msg.pid;
            } else {
              sub.send({ token : -1 });
            }
          } catch (e) {
          }
        } else if (msg.cmd === 'token_release') {
          _self.tokenPid = -1;
        }
      }

      if (!msg || !msg.type) {
        return;
      }

      if ('ready' === msg.type) {
        _options.listen.forEach(function (i) {
          if (!i) {
            return;
          }
          try {
            sub.send({'type' : 'listen', 'data' : i}, getHandle(i, _options['addr']));
          } catch (e) {
          }
        });
        _self.okcount++;
        if (_self.okcount >= _options.children / 2) {
          for (var i in _self.dielist) {
            if (workers[i]) {
              workers[i].kill('SIGTERM');
            }
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
    _self.okcount = n;

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
    _self.okcount = 0;

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
    _self.okcount = 0;
    Object.keys(workers).forEach(function (i) {
      _self.dielist[i] = true;
    });
    _self.start();
  };
  /* }}} */

  /* {{{ public prototype broadcast() */
  Child.prototype.broadcast = function (msg, from, pid, tid) {
    Object.keys(workers).forEach(function (i) {
      if (tid && tid != i) {
        return;
      }
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

if (process.env.NODE_ENV === 'test') {
  exports.mock = function (p) {
    PROCESS = p;
  };
}
