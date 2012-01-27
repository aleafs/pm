/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*+------------------------------------------------------------------------
 * cluster 管理API
 *
 * @author : pengchun@taobao.com
 *+------------------------------------------------------------------------
 */

var Http	= require('http');
var Worker	= require(__dirname + '/../../lib/cluster.js').Worker;

var admin	= new Worker();
var server	= Http.createServer(function (req, res) {
	// XXX:
	//
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('Hello World\n');
	admin.release();
});

admin.ready(function (socket) {
	server.connections++;
	server.emit('connection', socket);
});

