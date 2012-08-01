/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var connect = require('connect');

var app = require('http').createServer(connect(function (req, res) {
  res.end('Hello from Connect!\n');
}));

var worker = require('pm').createWorker();
worker.ready(function(socket) {
  app.emit('connection', socket);
});
