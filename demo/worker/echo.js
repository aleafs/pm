/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Worker  = require(__dirname + '/../../lib/cluster.js').Worker;

/**
 * @ load some static data sync
 */

var api  = new Worker();
api.ready(function (socket) {
  api.transact();			/**<	开始一次会话 */
  socket.setEncoding('ascii');
  socket.write('Now: ' + (new Date()) + '\n<- ');
  socket.on('data', function (data) {
    if ('bye' === data.slice(0, 3).toLowerCase()) {
      socket.write('Good Bye!\n');
      socket.end();
      api.release();	/**<	会话结束 */
    } else if ('fatal' === data.slice(0, 5).toLowerCase()) {
      process.exit(127);
    } else {
      setTimeout(function () {
        socket.write('-> [ sleep 100ms ] ' + data + '<- ');
      }, 100);
    }
  });
});
