/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var app = require(__dirname + '/../').createMaster({
  'pidfile'    : __dirname + '/bench.pid',
  'statusfile' : __dirname + '/status.log',
});

app.on('giveup', function (name, fatals, pause) {
  console.log('Master giveup to restart "%s" process after %d times. pm will try after %d ms.', name, fatals, pause);
});

app.on('disconnect', function (worker, pid) {
  // var w = cluster.fork();
  console.error('[%s] [master:%s] wroker:%s disconnect! new worker:%s fork', 
    new Date(), process.pid, worker.process.pid); //, w.process.pid);
});

app.on('fork', function () {
  console.log('fork', arguments);
});

app.on('quit', function () {
  console.log('quit', arguments);
});

/**
 * @ test fork error protect
 */
app.register('error', __dirname + '/worker/exception.js', {
  'children' : -1
});

/**
 * daemon process, log analysist or something else
 */
app.register('daemon', __dirname + '/worker/daemon.js', {
  'trace_gc': true,
  'children': 2
});

/**
 * A http service
 */
app.register('http', __dirname + '/worker/http.js', {
  'listen' : [ 33749, __dirname + '/http.socket', 33750 ],
  'children' : 1
});

/**
 * process serial start
 */
app.register('serial', __dirname + '/worker/serial.js', {
  'children': 2,
  'use_serial_mode': true
});

app.dispatch();
