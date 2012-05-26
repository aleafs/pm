/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

exports.create  = function() {

  var _stat = 0;

  /* {{{ 系统信号处理 */

  process.on('SIGHUB',  function() {
  });

  process.on('SIGUSR1', function() {
  });

  process.on('SIGTERM', function() {
  });

  /* }}} */

  var _me   = {};

  _me.ready = function(callback) {
    var socket  = null;
    callback(socket);
  };

  return _me;
};
