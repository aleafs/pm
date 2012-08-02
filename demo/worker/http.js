/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var worker  = require(__dirname + '/../../').createWorker();
var server  = require('http').createServer(function (req, res) {

  var chunk = '';
  req.on('data', function (data) {
    chunk += data;      /**<    ignore multibyte charactors, Don't follow me */
  });

  req.on('end', function () {
    var url   = req.url.split('?').shift().split('/')[1].toLowerCase();
    switch (url) {
      case 'cleancache':
        worker.sendto('daemon', 'Please clean your cache');
        break;

      case 'reload':
        worker.reload('daemon');
        break;

      case 'fatal':
        worker.sendto('daemon', 'fatal');
        break;

      default:
        break;
    }

    res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
    res.end(JSON.stringify({
      'method'  : req.method,
      'act'     : url,
      'url'     : req.url,
      'post'    : chunk,
    }));

    chunk   = null;
  });

});

worker.ready(function(socket) {
  server.emit('connection', socket);
});
