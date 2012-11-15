/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var worker = require(__dirname + '/../../').createWorker();

var s1 = require('http').createServer(function (req, res) {
  res.end(req.url);
});

var s2 = require('http').createServer(function (req, res) {

  var url = req.url.split('?').shift().split('/')[1].toLowerCase();
  switch (url) {
    case 'cleancache':
      worker.broadcast('daemon', 'Please clean your cache');
      break;

    case 'fatal':
      worker.broadcast('daemon', 'fatal');
      break;

      /*
    case 'reload':
      worker.reload('daemon');
      break;
*/

    default:
      break;
  }
  res.end(JSON.stringify({
    'act' : url,
    'url' : req.url,
  });
});

worker.ready(function(socket, which) {
  if (33749 === which) {
    s1.emit('connection', socket);
  } else {
    s2.emit('connection', socket);
  }
});
