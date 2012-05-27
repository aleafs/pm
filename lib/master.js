/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var CPUSNUM = require('os').cpus().lenth;

var _DEFINE = require(__dirname + '/common.js');

var _noop   = function() {
};

var _normalize  = function(name) {
  return name.toString().trim().toLowerCase();
};

var _writelog   = function(message) {
  console.log(message);
};

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
  var _mstatus  = _DEFINE.STATUS.PENDING;

  /**
   * @worker配置表
   */
  var _configs  = {};

  /**
   * @worker状态表
   */
  var _wstatus  = {};

  /**
   * @子进程状态表
   */
  var _pstatus  = {};

  /**
   * @等待消亡进程表
   */
  var _tobekill = [];

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
      'child_num'   : CPUSNUM,          /**<    子进程个数              */
      'max_request' : 0,                /**<    执行多少个请求后消亡    */
    };

    for (var i in options) {
      _conf[i]  = options[i];
    }

    var idx = _normalize(name);
    _configs[idx]   = _conf;
    if (!_wstatus[name]) {
      _wstatus[idx] = {
        'stat'  : _DEFINE.STATUS.PENDING,
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
      _wstatus[idx].stat = _DEFINE.STATUS.STOPING;
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
          fs.unlink(_options.pidfile, _noop);
        });
      });
    }
    /* }}} */

    /**
     * @SIGHUB
     */
    process.on('SIGHUB', _noop);

    /**
     * @SIGTERM
     */
    /* {{{ */
    process.on('SIGTERM', function() {
      _mstatus  = _DEFINE.STATUS.STOPING;
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
      _writelog('[master] got SIGUSR1');
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
    }
    /* }}} */

  };
  /* }}} */

  return _me;

};
