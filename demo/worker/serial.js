/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var worker = require(__dirname + '/../../').createWorker().serialStart(function (done) {
  console.log('child start!');
  done();
}, 100).ready();