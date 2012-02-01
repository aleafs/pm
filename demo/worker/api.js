/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Worker  = require(__dirname + '/../../lib/cluster.js').Worker;

/**
 * @ load some static data sync
 */

api  = new Worker();
api.ready(function (socket) {
  socket.setEncoding('ascii');
  socket.write('Now: ' + (new Date()) + '\n<- ');
  socket.on('data', function (data) {
    socket.write('-> ' + data + '<- ');
    if ('bye' == data.slice(0, 3).toLowerCase()) {
      socket.end();
      api.release();
    }
  });
});

