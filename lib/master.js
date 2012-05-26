/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var CPUSNUM = require('os').cpus().lenth;

var _normalize  = function (name) {
  return name.toString().trim().toLowerCase();
};

exports.create  = function (options) {

  /* {{{ variable _options */

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
   * @worker配置表
   */
  var _configs  = {};

  /**
   * @worker状态表
   */
  var _status   = {};

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
  _me.register  = function (name, file, options) {
    var _name   = _normalize(name);
    var _conf   = {
      'script'      : file,             /**<    启动的脚本文件名        */
      'listen'      : [],               /**<    监听的端口(socket path) */
      'child_num'   : CPUSNUM,          /**<    子进程个数              */
      'max_request' : 0,                /**<    执行多少个请求后消亡    */
    };

    for (var i in options) {
      _conf[i]  = options[i];
    }
    _configs[_name] = _conf;
    if (!_status[_name]) {
      _status[_name]  = {};
    }

    return _me;
  };
  /* }}} */

  /* {{{ public function dispatch() */
  /**
   * master运行
   *
   * @access public
   */
  _me.dispatch  = function () {
  };
  /* }}} */

  /* {{{ public function reload() */
  /**
   * 重新加载某个worker
   *
   * @access public
   * @param {String} name
   */
  _me.reload    = function (name) {
  };
  /* }}} */

  return _me;
};
