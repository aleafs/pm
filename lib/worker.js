/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var Socket  = require('net').Socket;

var common = require('./common');
var listen = common.listen;
var debug = common.debug;
var STATUS  = common.STATUS;
var MESSAGE = common.MESSAGE;
var MAX_HEARTBEAT_INTERVAL = common.MAX_HEARTBEAT_INTERVAL;
var arrayJoin = Array.prototype.join;

var NOTICE  = function (name, message) {
  debug('worker', arrayJoin.call(arguments, ' '));
};

/* {{{ private function _send() */
/**
 * 向父进程发送消息
 *
 * @access private
 * @param {Number} type: see MESSAGE
 * @param {Object} data
 */
if (!process.hasOwnProperty('send')) {
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

/* {{{ private function _accept() */
var _accept = function (handle, port, callback) {
  if (!handle) {
    return;
  }
  if (!callback) {
    handle.close();
    handle = null;
    return;
  }

  var _me   = new Socket({
    'handle'  : handle,
  });

  _me.readable  = true;
  _me.writable  = true;
  _me.resume();
  _me.on('error', function (error) {
    NOTICE('SOCKET', error.stack);
  });
  _me.emit('connect');
  callback(_me, port);
};
/* }}} */

exports.create  = function (options) {

  var _me   = {};

  /* {{{ 控制参数 */

  var _conf = {};
  options = options || {};
  _conf.heartbeat_interval = parseInt(options.heartbeat_interval, 10) || 2000;
  _conf.terminate_timeout = parseInt(options.terminate_timeout, 10) || 1000;
  if (_conf.heartbeat_interval > MAX_HEARTBEAT_INTERVAL) {
    _conf.heartbeat_interval = MAX_HEARTBEAT_INTERVAL;
  }
  /* }}} */

  /**
   * @心跳数据
   */
  var mstat = {
    'status'    : STATUS.PENDING,
    'scores'    : 0,
  };

  /**
   * @其他worker发来的消息处理函数
   */
  var onmsg = [];

  /**
   * @worker直听模式
   */
  var _listener = {};

  /* {{{ 心跳方法 */

  var heartbeat = function () {
    mstat.mem   = process.memoryUsage();
    _send(MESSAGE.STATUS, mstat);
  };

  /* }}} */

  /* {{{ 信号处理 */

  process.on('SIGHUB',  function () {});
  process.on('SIGTERM', function () {
    mstat.status = STATUS.STOPING;
    for (var idx in _listener) {
      var _fd = _listener[idx];
      _fd.close();
      _fd = null;
    }
    _listener   = {};

    setTimeout(function () {
      process.exit(0);
    }, _conf.terminate_timeout);
  });
  process.on('exit',    function () {
    NOTICE('terminated after ' + Number(process.uptime()).toFixed(3) + ' seconds.');
  });

  /* }}} */

  /* {{{ public function ready() */
  /**
   * worker进入运行状态
   */
  _me.ready = function (callback) {
    mstat   = {
      'status'  : STATUS.RUNNING,
      'scores'  : 0,
    };
    heartbeat();
    setInterval(heartbeat, _conf.heartbeat_interval);

    process.on('message', function (msg, handle) {
      if (!msg || !msg.type) {
        return;
      }

      switch (msg.type) {
        case MESSAGE.REQ_FD:
          mstat.scores++;
          _accept(handle, msg.port, callback);
          break;

        case MESSAGE.COMMAND:
          onmsg.forEach(function (cb) {
            if (cb && msg.data) {
              cb(msg.data, msg.from, msg.pid);
            }
          });
          break;

        default:
          break;
      }
    });

    return _me;
  };
  /* }}} */

  /* {{{ public function onmessage() */
  /**
   * 消息处理函数
   *
   * @access public
   */
  _me.onmessage = function (cb) {
    if (!cb) {
      onmsg = [];
    } else {
      onmsg.push(cb);
    }
  };
  /* }}} */

  /* {{{ public function sendto() */
  /**
   * 向其他进程发送消息
   *
   * @access public
   * @param {String} who, process name
   * @param {Object} data
   */
  _me.sendto    = function (who, data) {
    _send(MESSAGE.SENDTO, {
      'name' : who,
      'data' : data,
    });
  };
  /* }}} */

  /* {{{ public function reload() */
  /**
   * reload其他进程
   *
   * @access public
   * @param {String} who, process name
   */
  _me.reload    = function (who) {
    _send(MESSAGE.RELOAD, {
      'name' : who,
    });
  };
  /* }}} */

  return _me;

};
