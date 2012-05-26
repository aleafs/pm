/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

exports.create  = function (options) {

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
