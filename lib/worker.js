/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var net = require('net');
var util = require('util');
var Emitter = require('events').EventEmitter;

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
      try {
        PROCESS.send({'type' : type, 'data' : data});
      } catch (e) {
      }
    }
  }

  /**
   * @ 连接处理
   */
  var onconnect = function (socket, which) {
    socket.close();
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

  /* {{{ private function suicide() */
  var suicide = function () {
    Object.keys(_listener).forEach(function (i) {
      try {
        _listener[i].close();
      } catch (e) {
      }
    });
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

      console.log(msg);
      if (handle && 'listen' === msg.type) {
        if (_listener[msg.data]) {
          try {
            _listener[msg.data].close();
          } catch (e) {
          }
        }
        _listener[msg.data] = net.createServer(function (socket) {
          onconnect(socket, msg.data);
        }).listen(handle);
        _self.emit('listen', msg.data);
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
    askmaster('gethandle');
    onconnect = function (socket, which) {
      if (!_scores[which]) {
        _scores[which] = 1;
      } else {
        _scores[which]++;
      }
      callback(socket, which);
    };
  };
  /* }}} */

  /* {{{ public prototype broadcast() */
  /**
   * Broadcast message around workers
   */
  Worker.prototype.broadcast = function (who, msg) {
    askmaster('broadcast', {
      'who' : who,
      'msg' : msg,
    });
  };
  /* }}} */

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

