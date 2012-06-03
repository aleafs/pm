/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var worker  = require(__dirname + '/../../').Worker();
var server  = require('http').createServer(function (req, res) {

  var url   = req.url.split('?').shift().split('/')[1].toLowerCase();
  switch (url) {
    case 'cleancache':
      worker.sendto('daemon', 'Please clean your cache');
      break;

    case 'reload':
      worker.reload('daemon');
      break;

    default:
      break;
  }

  res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
  res.end(JSON.stringify({
    'act'   : url,
    'url'   : req.url,
  }));
});

worker.ready(function(socket) {
  server.emit('connection', socket);
});
