/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var app = require(__dirname + '/../').createMaster({
  'pidfile'    : __dirname + '/bench.pid',
  'statusfile' : __dirname + '/status.log',
});

/**
 * daemon process, log analysist or something else
 */
if (0)
app.register('daemon', __dirname + '/worker/daemon.js', {
  'trace_gc': true,
  'children': 1,
});

/**
 * A http service
 */
app.register('http', __dirname + '/worker/http.js', {
  'listen' : [ 33749, __dirname + '/http.socket' ],
});

app.on('giveup', function (name, fatals, pause) {
  console.log('Master giveup to restart "%s" process after %d times.', name, fatals);
});

app.dispatch();
