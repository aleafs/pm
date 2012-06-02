/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Socket  = require('net').Socket;

var STATUS  = require(__dirname + '/common.js').STATUS;
var MESSAGE = require(__dirname + '/common.js').MESSAGE;
var Debug   = require(__dirname + '/common.js').debug;

var Log = function(name, message) {
  Debug('worker', name + ' ' + message);
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
  var _send = function(type, data) {
    Log('_SEND', JSON.stringify({
      'type'    : type,
      'data'    : data,
    }));
  };
} else {
  var _send = function(type, data) {
    try {
      process.send({
        'type'  : type,
        'data'  : data,
      });
    } catch (e) {
      Log('ERROR', e.toString());
    }
  };
}
/* }}} */

/* {{{ private function _socket() */
var _socket = function(handle) {
  var _me   = new Socket({
    'handle'  : handle,
  });

  _me.readable  = true;
  _me.writable  = true;
  _me.resume();
  _me.on('error', function (err) {
    Log('SOCKET', err.toString());
  });
  _me.emit('connect');

  return _me;
};
/* }}} */

exports.create  = function(options) {

  var _me   = {};

  /* {{{ 控制参数 */

  var _conf = {
    'heartbeat_interval' : 2000,
    'terminate_timeout'  : 1000,
  };
  for (var i in options) {
    _conf[i] = options[i];
  }
  /* }}} */

  /**
   * @心跳数据
   */
  var mstat = {
    'uptime'    : 0,
    'status'    : STATUS.PENDING,
    'scores'    : 0,
  };

  /**
   * @其他worker发来的消息处理函数
   */
  var onmsg = [];

  /* {{{ 心跳方法 */

  var heartbeat = function() {
    _send(MESSAGE.STATUS, mstat);
  };

  /* }}} */

  /* {{{ 信号处理 */

  process.on('SIGHUB',  function() {
  });
  process.on('SIGTERM', function() {
    mstat.status = STATUS.STOPING;
    setTimeout(function() {
      process.exit(0);
    }, _conf.terminate_timeout);
  });
  process.on('exit',    function() {
  });

  /* }}} */

  /* {{{ public function ready() */
  /**
   * worker进入运行状态
   */
  _me.ready = function(callback) {
    mstat   = {
      'uptime'  : (new Date()).getTime(),
      'status'  : STATUS.RUNNING,
      'scores'  : 0,
    };
    heartbeat();
    setInterval(heartbeat, _conf.heartbeat_interval);

    process.on('message', function(msg, handle) {
      if (!msg || !msg.type) {
        return;
      }

      switch (msg.type) {
        case MESSAGE.REQ_FD:
          if (!handle) {
            return;
          }

          if (STATUS.RUNNING === mstat.status) {
            process.nextTick(function() {
              _send(MESSAGE.GET_FD);
            });
          }

          if (!callback) {
            handle.close();
            handle  = null;
          } else {
            callback(_socket(handle));
          }
          break;

        case MESSAGE.WAKEUP:
          _send(MESSAGE.GET_FD);
          break;

        case MESSAGE.LISTEN:
          break;

        case MESSAGE.COMMAND:
          onmsg.forEach(function(cb) {
            if (cb && msg.data) {
              cb(msg.data);
            }
          });
          break;

        default:
          break;
      }
    });

  };
  /* }}} */

  /* {{{ public function onmessage() */
  /**
   * 消息处理函数
   *
   * @access public
   */
  _me.onmessage = function(cb) {
    if (!cb) {
      onmsg = [];
    } else {
      onmsg.push(cb);
    }
  };
  /* }}} */

  /* {{{ public function tell() */
  /**
   * 向其他进程发送消息
   *
   * @access public
   * @param {String} who, process name
   * @param {Object} data
   */
  _me.tell  = function(who, data) {
    _send(MESSAGE.SENDTO, {
      'name' : who,
      'data' : data,
    });
  };
  /* }}} */

  return _me;

};
