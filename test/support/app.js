var cluster = require('../../');
var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHeader(200, {
    'Content-Type': 'text/plain;charset=utf-8'
  });
  res.write(req.method + ' ' + req.url);
  req.on('data', function(data) {
    res.write(data);
  });
  req.on('end', function() {
    res.end();
  });
});

cluster.ready(function(socket) {
  server.emit('connection', socket);
});