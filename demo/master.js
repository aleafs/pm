/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var app = require(__dirname + '/../').createMaster({
  'pidfile'    : __dirname + '/bench.pid',
  'statusfile' : __dirname + '/status.log',
});

app.on('giveup', function (name, fatals, pause) {
  console.log('Master giveup to restart "%s" process after %d times. pm will try after %d ms.', name, fatals, pause);
});

/**
 * @ test fork error protect
 */
app.register('error', __dirname + '/worker/exception.js', {
  'children' : 1
});

/**
 * daemon process, log analysist or something else
 */
app.register('daemon', __dirname + '/worker/daemon.js', {
  'trace_gc': true,
  'children': 2,
});

/**
 * A http service
 */
app.register('http', __dirname + '/worker/http.js', {
  'listen' : [ 33749, __dirname + '/http.socket' ],
  'children' : 1
});

app.dispatch();
