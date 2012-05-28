/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var server  = require('http').createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
  res.end('hello world');
});

require(__dirname + '/../../').Worker().ready(function(socket) {
  server.emit('connection', socket);
});
