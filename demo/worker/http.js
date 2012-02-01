/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*+------------------------------------------------------------------------
 * cluster 管理API
 *
 * @author : pengchun@taobao.com
 *+------------------------------------------------------------------------
 */

var Http  = require('http');
var Worker  = require(__dirname + '/../../lib/cluster.js').Worker;


var REQUEST_QUEQUE = [];

var admin  = new Worker();
var server  = Http.createServer(function (req, res) {
  admin.ping();
  REQUEST_QUEQUE.push(REQUEST_QUEQUE.length);

  // XXX: DO SOMETHIS
  res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
  res.end('hello world');

  REQUEST_QUEQUE.pop();
  admin.release(REQUEST_QUEQUE.length);
});

admin.ready(function (socket) {
  server.emit('connection', socket);
});

