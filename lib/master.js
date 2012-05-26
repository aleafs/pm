/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var _normalize    = function (name) {
  return name.toString().trim().toLowerCase();
};

exports.create  = function (options) {

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
    var _conf   = {
    };
    _configs[_normalize(name)] = _conf;
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
