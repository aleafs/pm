/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var net = require('net');
var util = require('util');

var Emitter = require('events').EventEmitter;

var NOTICE  = function () {
  console.log('[worker:%d][%s] %s', process.pid, (new Date()), Array.prototype.join.call(arguments, ' '));
};

/* {{{ private function _send() */
/**
 * 向父进程发送消息
 *
 * @access private
 * @param {String} type
 * @param {Object} data
 */
if ('function' !== (typeof process.send)) {
  var _send = function (type, data) {
    NOTICE('_SEND', JSON.stringify({
      'type'    : type,
      'data'    : data,
    }));
  };
} else {
  var _send = function (type, data) {
    try {
      process.send({
        'type'  : type,
        'data'  : data,
      });
    } catch (e) {
      NOTICE('ERROR', e.stack);
      process.exit(0);
    }
  };
}
/* }}} */

exports.create = function (options) {

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
    _send('heartbeat', {
      'hbterm' : _options.heartbeat_interval,
      'scores' : _scores,
      'memory' : process.memoryUsage(),
    });
  };
  process.send && setInterval(heartbeat, _options.heartbeat_interval);

  /* {{{ private function suicide() */
  var suicide = function () {
    Object.keys(_listener).forEach(function (i) {
      _listener[i].close();
    });
    setTimeout(function () {
      process.exit(0);
    }, _options.terminate_timeout);
  };
  /* }}} */

  process.on('SIGHUB',  function () {});
  process.on('SIGTERM', suicide);
  process.on('exit', function () {
    NOTICE('terminated after ' + Number(process.uptime()).toFixed(3) + ' seconds.');
  });

  /* {{{ public Worker constructor */
  var Worker = function () {
    Emitter.call(this);

    var _self = this;
    process.on('message', function (msg, handle) {
      if (handle || 'listen' === msg.type) {
        if (_listener[msg.data]) {
          _listener[msg.data].close();
        }
        _listener[msg.data] = net.createServer(function (socket) {
          onconnect(socket, msg.data);
        }).listen(handle);
        return;
      }

      switch (msg.type) {
        case 'suicide':
          suicide();
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
    _send('gethandle');
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

  /* {{{ public prototype setLogger() */
  Worker.prototype.setLogger = function (cb) {
    NOTICE = cb;
  };
  /* }}} */

  /* {{{ public prototype broadcast() */
  /**
   * Broadcast message around workers
   */
  Worker.prototype.broadcast = function (who, msg) {
    _send('broadcast', {
      'who' : who,
      'msg' : msg,
    });
  };
  /* }}} */

  return new Worker();
};

