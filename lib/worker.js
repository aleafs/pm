/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Util    = require('util');
var Events  = require('events');

var STATUS  = require(__dirname + '/define.js').STATUS;
var MESSAGE = require(__dirname + '/define.js').MESSAGE;

var _noop   = function () {
};

exports.create  = function(callback, options) {

  var Worker    = function() {
    Events.EventEmitter.call(this);
  };
  Util.inherits(Worker, Events.EventEmitter);

  var _me   = new Worker();

  /* {{{ 控制参数 */

  var _conf = {
    'heartbeat_interval' : 2000,
    'terminate_timeout'  : 5000,
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

  /* {{{ 发送消息 */
  if (!process.hasOwnProperty('send')) {
    var _send   = _noop;
  } else {
    var _send = function(type, data) {
      try {
        process.send({
          'type'  : type,
          'data'  : data,
        });
      } catch (e) {
      }
    };
  }
  /* }}} */

  /* {{{ 心跳方法 */

  var heartbeat = function() {
    _send(MESSAGE.STATUS, mstat);
  };

  /* }}} */

  /* {{{ 信号处理 */

  process.on('SIGHUB',  _noop);
  process.on('SIGUSR1', _noop);
  process.on('SIGTERM', function() {
    mstat.status = STATUS.STOPING;
    setTimeout(function() {
      process.exit(0);
    }, _conf.terminate_timeout);
  });

  /* }}} */

  /* {{{ 消息处理 */

  process.on('message', function(msg, handle) {
    if (!msg || !msg.type) {
      return;
    }

    switch (msg.type) {
      case MESSAGE.REQ_FD:
        if (handle && STATUS.RUNNING === mstat.status) {
          process.nextTick(function() {
            _send(MESSAGE.GET_FD);
          });
        }
        break;

      case MESSAGE.WAKEUP:
        _send(MESSAGE.GET_FD);
        break;

      case MESSAGE.LISTEN:          /**<    worker监听  */
        break;

      case MESSAGE.COMMAND:
        _me.emit('message');
        break;

      default:
        break;
    }
  });
  /* }}} */

  /* {{{ public function run() */
  /**
   * worker进入运行状态
   */
  Worker.prototype.run  = function() {
    mstat   = {
      'uptime'  : (new Date()).getTime(),
      'status'  : STATUS.RUNNING,
      'scores'  : 0,
    };
    heartbeat();
    setInterval(heartbeat, _conf.heartbeat_interval);
  };
  /* }}} */

  /* {{{ public function hello() */
  /**
   * 向其他进程发送消息
   *
   * @access public
   * @param {String} who, process name
   * @param {Object} data
   */
  Worker.prototype.hello = function(who, data) {
    _send(MESSAGE.SENDTO, {
      'name' : who,
      'data' : data,
    });
  };
  /* }}} */

  /* {{{ public function free() */
  /**
   * worker空闲
   */
  Worker.prototype.free  = function() {
    if (STATUS.STOPING === mstat.status) {
      process.nextTick(function() {
        process.exit(0);
      });
    }
  };
  /* }}} */

  return _me;

};
