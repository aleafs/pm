/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var cluster = require('../../');
var http    = require('http');

var Args    = new Buffer("\r\n\r\n" + JSON.stringify(process.argv));

var server  = http.createServer(function(req, res) {
  res.writeHeader(200, {
    'Content-Type': 'text/plain;charset=utf-8'
  });
  res.write(req.method + ' ' + req.url);
  req.on('data', function(data) {
    res.write(data);
  });
  req.on('end', function() {
    if (req.url.indexOf('/print_args') >= 0) {
      res.end(Args);
    } else {
      res.end();
    }
  });
});

cluster.ready(function(socket) {
  server.emit('connection', socket);
});
