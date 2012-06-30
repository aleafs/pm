/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Util    = require('util');

var Master  = require(__dirname + '/../').Master({
  'pidfile'    : __dirname + '/bench.pid',
  'statusfile' : __dirname + '/status.log',
});

/**
 * daemon process, log analysist or something else
 */
Master.register('daemon', __dirname + '/worker/daemon.js', {
  'trace_gc': true,
});

/**
 * A http service
 */
Master.register('http',   __dirname + '/worker/http.js', {
  'listen'  : [ 33749, __dirname + '/http.socket' ],
  'children'    : 1,
});

Master.on('giveup', function (name, fatals) {
  //XXX: alert
  console.log(Util.format('Master giveup to restart %s process after %d times.', name, fatals));
});

Master.on('state', function (name, current, before) {
  console.log(Util.format('Process state change for %s, current: %d, before: %d', name, current, before));
});

