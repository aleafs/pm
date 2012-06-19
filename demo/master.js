/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Master  = require(__dirname + '/../').Master({
  'pidfile' : __dirname + '/bench.pid',
});

/**
 * daemon process, log analysist or something else
 */
Master.register('daemon', __dirname + '/worker/daemon.js', {
  'children'    : 1,
});

/**
 * A http service
 */
var server  = Master.register('http',   __dirname + '/worker/http.js', {
  'listen'  : [ 33751, __dirname + '/http.socket' ],
});

/***
  server.beforeStop(function() {

  // tell service center to set me offline
  //
  });
  */
