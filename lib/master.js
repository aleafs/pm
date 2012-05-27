/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var STATUS  = require(__dirname + '/common.js').STATUS;
var MESSAGE = require(__dirname + '/common.js').MESSAGE;
var Debug   = require(__dirname + '/common.js').debug;

var Log = function(name, message) {
  Debug('master', name + ' ' + message);
};

var CPUSNUM = require('os').cpus().length;

/* {{{ private function _normalize() */
var _normalize  = function(name) {
  return name.toString().trim().toLowerCase();
};
/* }}} */

exports.create  = function(options) {

  /**
   * @_options
   */
  /* {{{ */
  var _options  = {
    'pidfile'               : null,         /**<    进程PID文件             */
    'max_fatal_restart'     : 5,            /**<    异常退出最大重启次数    */
    'restart_time_window'   : 60,           /**<    异常重启统计时间窗口(s) */
  };
  for (var i in options) {
    _options[i] = options[i];
  }
  /* }}} */

  /**
   * @master状态
   */
  var _mstatus  = STATUS.PENDING;

  /**
   * @worker配置表
   */
  var _configs  = {};

  /**
   * @worker状态表
   */
  var _wstatus  = {};

  /**
   * @worker连接队列
   */
  var _wcqueue  = {};

  /**
   * @子进程状态表
   */
  var _pstatus  = {};

  /**
   * @等待消亡进程表
   */
  var _tobekill = [];

  /**
   * _newchild
   */
  /* {{{ */
  var _newchild = function(name, args, options) {
    var sub   = require('child_process').fork(path, args, options);
    sub.on('message', function(msg) {
      if (!msg.type) {
        return;
      }

      switch (msg.type) {
        case MESSAGE.GET_FD:
          break;

        case MESSAGE.STATUS:
          break;

        case MESSAGE.RELOAD:
          break;

        case MESSAGE.SENDTO:
          break;

        default:
          break;
      }
    });

    return sub;
  };
  /* }}} */

  var _me   = {};

  /* {{{ public function register() */
  /**
   * 注册worker
   *
   * @access public
   * @param {String} name
   * @param {String} file
   * @param {Object} options
   */
  _me.register  = function(name, file, options) {
    var _conf   = {
      'script'      : file,             /**<    启动的脚本文件名        */
      'listen'      : [],               /**<    监听的端口(socket path) */
      'children'    : CPUSNUM,          /**<    子进程个数              */
      'max_request' : 0,                /**<    执行多少个请求后消亡    */
    };

    for (var i in options) {
      _conf[i]  = options[i];
    }

    var idx = _normalize(name);
    _configs[idx]   = _conf;
    if (!_wcqueue[idx]) {
      _wcqueue[idx] = [];
    }

    if (!_wstatus[idx]) {
      _wstatus[idx] = {
        'stat'  : STATUS.PENDING,
        'runs'  : 0,                /**<    正在运行的进程数    */
        'conn'  : 0,                /**<    待处理请求数        */
      };
    }

    return _me;
  };
  /* }}} */

  /* {{{ public function shutdown() */
  /**
   * @停止某个worker
   *
   * @param {String} idx
   */
  _me.shutdown  = function(idx) {
    idx = _normalize(idx);
    if (_wstatus[idx]) {
      _wstatus[idx].stat = STATUS.STOPING;
    }

    for (var pid in _pstatus) {
      if (idx === _pstatus[pid].name) {
        process.kill(pid, 'SIGTERM');
      }
    }
  };
  /* }}} */

  /* {{{ public function reload() */
  /**
   * 重新加载某个worker
   *
   * @access public
   * @param {String} idx
   */
  _me.reload    = function(idx) {
    idx = _normalize(idx);
    for (var pid in _pstatus) {
      if (idx === _pstatus[pid].name) {
        _tobekill.push(pid);
      }
    }
  };
  /* }}} */

  /* {{{ public function dispatch() */
  /**
   * master运行
   *
   * @access public
   */
  _me.dispatch  = function() {

    /**
     * @PID file
     */
    /* {{{ */
    if (_options.pidfile) {
      var fs    = require('fs');
      fs.writeFile(_options.pidfile, process.pid, function(error) {
        if (error) {
          throw error;
        }
        process.on('exit', function() {
          fs.unlink(_options.pidfile, function(error) {
          });
        });
      });
    }
    /* }}} */

    /**
     * @SIGHUB
     */
    process.on('SIGHUB', function() {
    });

    /**
     * @SIGTERM
     */
    /* {{{ */
    process.on('SIGTERM', function() {
      _mstatus  = STATUS.STOPING;
      Log('SIGNALS', 'Got SIGTERM, about to exit...');
      for (var name in _configs) {
        _me.shutdown(name);
      }
    });
    /* }}} */

    /**
     * @SIGUSR1
     */
    /* {{{ */
    process.on('SIGUSR1', function() {
      Log('SIGNALS', 'Got SIGUSR1, about to reload...');
      for (var name in _configs) {
        _me.reload(name);
      }
    });
    /* }}} */

    /**
     * @启动服务
     */
    /* {{{ */
    for (var name in _configs) {
      var _this = _configs[name];
      for (var i = 0; i < _this.children; i++) {
      }
    }
    /* }}} */

  };
  /* }}} */

  return _me;

};
