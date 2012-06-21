/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var server  = require('http').createServer(function (req, res) {

  var chunk = '';
  req.on('data', function (data) {
    chunk += data;      /**<    ignore multibyte charactors, Don't follow me */
  });

  req.on('end', function () {
    res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
    res.end(JSON.stringify({
      'method'  : req.method,
      'url'     : req.url,
      'post'    : chunk,
    }));

    chunk   = null;
  });

});

require(__dirname + '/../../lib/cluster.js').Worker().ready(function(socket) {
  server.emit('connection', socket);
});
