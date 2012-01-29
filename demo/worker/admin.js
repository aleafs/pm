/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*+------------------------------------------------------------------------
 * cluster 管理API
 *
 * @author : pengchun@taobao.com
 *+------------------------------------------------------------------------
 */

var Http	= require('http');
var Worker	= require(__dirname + '/../../lib/cluster.js').Worker;

var count	= 0;
var admin	= new Worker();
var server	= Http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
	res.end('hello world');
	//res.end('Your request url is: ' + req.url + '\n');
	admin.release();
});

admin.ready(function (socket) {
	server.connections++;
	server.emit('connection', socket);
});

