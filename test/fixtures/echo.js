/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

require(__dirname + '/../../').createWorker().ready(function (socket) {
  socket.setEncoding('ascii');
  socket.on('data', function (data) {
    if ('bye' === data.slice(0, 3)) {
      socket.write('Good Bye!\n');
      socket.end();
    } else if ('fatal' === data.slice(0, 5)) {
      socket.write('Got fatal');
      process.exit(127);
    } else if ('sleep' === data.slice(0, 5)) {
      setTimeout(function () {
        socket.write('-> [ sleep 20ms ] ' + data + '<- ');
      }, 20);
    } else {
      socket.write('<- ' + data);
    }
  });
});

