/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

/**
 * @BufferHelper
 */
/* {{{ */
var BufferHelper    = function() {
  var chunk = [];
  var total = 0;

  var _me   = {};
  _me.push  = function(data) {
    chunk.push(data);
    total += data.length;
  };

  _me.join  = function() {
    if (0 == chunk.length) {
      return new Buffer(0);
    }

    if (1 == chunk.length) {
      return chunk[0];
    }

    var data  = new Buffer(total), pos = 0;
    chunk.forEach(function(item) {
      item.copy(data, pos);
      pos += item.length;
    });

    return data;
  };

  return _me;
};
/* }}} */

var server  = require('http').createServer(function (req, res) {

  var chunk = BufferHelper();
  req.on('data', function(data) {
    chunk.push(data);
  });

  req.on('end', function() {
    res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
    res.end(JSON.stringify({
      'url' : req.url,
      'data': chunk.join().toString(),
    }));
  });
});

require(__dirname + '/../../lib/cluster.js').Worker().ready(function(socket) {
  server.emit('connection', socket);
});
