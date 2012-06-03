/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var worker  = require(__dirname + '/../../').Worker().ready();
worker.onmessage(function(msg) {
  console.log('Got message : ' + msg);
});

setInterval(function() {
  console.log('i am alive ... ' + (new Date()));
}, 5000);

