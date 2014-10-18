/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var worker = require(__dirname + '/../../').createWorker();
worker.on('message', function (msg, from, pid) {
  console.log('[%d]: Got message "%s" from %s by %d', process.pid, msg, from, pid);
  switch (msg.toString()) {
    case 'fatal':
      process.exit(127);
      break;

    default:
      break;
  }
});

worker.ready();
