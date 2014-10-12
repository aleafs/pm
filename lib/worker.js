/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var net = require('net');
var util = require('util');
var Emitter = require('events').EventEmitter;
var listen2 = require(__dirname + '/common.js').listen2;

exports.create = function (options, PROCESS) {

  /**
   * @ 配置参数
   */
  var _options  = {
    'heartbeat_interval' : 2000,
    'terminate_timeout'  : 1000,
  };
  for (var i in options) {
    _options[i] = ~~Number(options[i]);
  }

  /**
   * @ 方便单元测试
   */
  PROCESS = PROCESS || process;

  /**
   * @ send message to master
   */
  var askmaster = function () {};
  if ('function' === (typeof PROCESS.send)) {
    askmaster = function (type, data) {
      PROCESS.send({'type' : type, 'data' : data});
    };
  }

  /**
   * @ 连接处理
   */
  var onconnect = function (socket, which) {
    socket.end();
  };

  /**
   * @ 监听句柄
   */
  var _listener = {};

  /**
   * @ 记分板
   */
  var _scores = {};

  /**
   * @ 心跳函数
   */
  var heartbeat = function () {
    askmaster('heartbeat', {
      'hbterm' : _options.heartbeat_interval,
      'scores' : _scores,
      'memory' : PROCESS.memoryUsage(),
    });
  };
  PROCESS.send && setInterval(heartbeat, _options.heartbeat_interval);

  /**
   * Close all open lsitening handles.
   */
  var closeListeners = function () {
    Object.keys(_listener).forEach(function (i) {
      try {
        _listener[i].close();
        delete _listener[i];
      } catch (e) {
      }
    });
  };

  /* {{{ private function suicide() */
  var suicide = function () {
    closeListeners();
    setTimeout(function () {
      PROCESS.exit(0);
    }, _options.terminate_timeout);
  };
  /* }}} */

  /* {{{ public Worker constructor */
  var Worker = function () {
    Emitter.call(this);

    var _self = this;
    PROCESS.on('message', function (msg, handle) {
      if (!msg || !msg.type) {
        return;
      }

      if (handle && 'listen' === msg.type) {
        var idx = msg.data; // port or sock
        if (_listener[idx]) {
          _listener[idx].close();
          delete _listener[idx];
        }
        _listener[idx] = listen2(handle, function (socket) {
          onconnect(socket, idx);
        });
        process.nextTick(function () {
          _self.emit('listen', idx);
        });
        return;
      }

      switch (msg.type) {
        case 'suicide':
          suicide();
          _self.emit('suicide', 'message');
          break;

        case 'hello':
          _self.emit('message', msg.data, msg.from, msg._pid);
          break;

        default:
          break;
      }
    });
  };
  util.inherits(Worker, Emitter);
  /* }}} */

  /* {{{ public prototype ready() */
  Worker.prototype.ready = function (callback) {
    /**
     * @ 找master要监听handle
     */
    askmaster('ready');
    if ('function' === (typeof callback)) {
      onconnect = callback;
    }
  };
  /* }}} */

  /* {{{ public prototype broadcast() */
  /**
   * Broadcast message around workers
   */
  Worker.prototype.broadcast = function (who, msg, pid) {
    askmaster('broadcast', {
      'who' : who,
      'pid' : pid || 0,
      'msg' : msg,
    });
  };
  /* }}} */

  Worker.prototype.disconnect = function () {
    var worker = {
      suicide: true,
      process: {
        pid: PROCESS.pid,
      }
    };
    askmaster('disconnect', worker);
    // close listeners, do not accept new connection.
    closeListeners();
  };

  /* {{{ public prototype serialStart() */
  /**
   * serial start child Process
   */
  Worker.prototype.serialStart = function (cb, serialModeGetTokenTimeout) {
    var timeout = serialModeGetTokenTimeout || 100;
    var ctimer;
    var childPid = PROCESS.pid;
    var _self = this;

    if (!cb || typeof cb !== 'function') {
      return;
    }

    PROCESS.on('message', function (tokenRes) {
      if (!tokenRes.token) {
        return;
      }
      
      if (tokenRes.token >= 0) {
        clearTimeout(ctimer);
        try{
          cb.call(_self, releaseToken);
        } catch (e) {
        }
      } else {
        ctimer = setTimeout(function () {
          try{
            PROCESS.send({
              cmd : 'token_get', 
              pid : childPid
            });
          } catch (e) {
          }
        }, timeout);
      }
    });
    try{
      PROCESS.send({
        cmd : 'token_get', 
        pid : childPid
      });
    } catch (e) {
    }
    return _self;
  };
  /* }}} */

  var releaseToken = function () {
    PROCESS.send({cmd : 'token_release'});
  };

  var _me = new Worker();

  PROCESS.on('SIGHUB',  function () {});
  PROCESS.on('SIGTERM', function () {
    suicide();
    _me.emit('suicide', 'SIGTERM');
  });
  PROCESS.once('exit', function () {
    _me.emit('exit');
  });

  return _me;
};

