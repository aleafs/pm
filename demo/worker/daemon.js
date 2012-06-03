/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var worker  = require(__dirname + '/../../').Worker().ready();
worker.onmessage(function(msg) {
  switch (msg.toString()) {
    case 'fatal':
      process.exit(127);
      break;

    default:
      console.log('Got message : ' + msg);
      break;
  }
});

setInterval(function() {
  console.log('i am alive ... ' + (new Date()));
}, 5000);

