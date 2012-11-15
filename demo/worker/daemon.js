/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var worker = require(__dirname + '/../../').createWorker().ready();
worker.on('message', function (msg, from, pid) {
  console.log('Got message "%s" from %s by %d', msg, fromm, pid);
  switch (msg.toString()) {
    case 'fatal':
      process.exit(127);
      break;

    default:
      break;
  }
});

setInterval(function() {
  console.log('i am alive ... ' + (new Date()));
}, 5000);

