/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Master  = require(__dirname + '/../').createMaster({
  'pidfile'    : __dirname + '/bench.pid',
  'statusfile' : __dirname + '/status.log',
});

/**
 * daemon process, log analysist or something else
 */
Master.register('daemon', __dirname + '/worker/daemon.js', {
  'trace_gc': true,
  'children': 1,
});

/**
 * A http service
 */
Master.register('http',   __dirname + '/worker/http.js', {
  'listen'  : [ 33749, __dirname + '/http.socket' ],
});

if (1) {
  /**
   * should be force killed after 2.6 * 30 (s)
   */
  Master.register('while',   __dirname + '/worker/while.js', {
    'children': 1,
  });
}

Master.on('giveup', function (name, fatals) {
  //XXX: alert
  console.log('Master giveup to restart %s process after %d times.', name, fatals);
});

