/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var worker  = require(__dirname + '/../../').Worker();
worker.onmessage(function(msg, from) {
  console.log('Got message from ' + from + ': ' + msg);
});

setInterval(function() {
  console.log('i am alive ... ' + (new Date()));
}, 5000);

