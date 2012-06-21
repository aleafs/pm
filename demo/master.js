/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Util    = require('util');

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
Master.register('http',   __dirname + '/worker/http.js', {
  'listen'  : [ 33751, __dirname + '/http.socket' ],
  'trace_gc': true,
});

Master.on('giveup', function (name, fatals) {
  //XXX: alert
  console.log(Util.format('Master giveup to restart %s process after %d times.', name, fatals));
});

Master.on('stat', function (name, current, before) {
  console.log(Util.format('Process stat change for %s, current: %d, before: %d', name, current, before));
});

