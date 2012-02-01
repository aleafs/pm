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
	// XXX: 
	// 这个值最好能在一个HTTP协议第一个消息包到达的时候进行累加，绑定在 socket 的 data 事件上
	// 否则在keep-alive模式下，当 worker 需要平滑重启的时候，会有客户端 HTTP 协议包还没发完就被reset了 
	count++;

	res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
	res.end('hello world');

	admin.release();
	// XXX: 协议内部维护 remain 计数 , 一定要在 release 之后调用
	admin.monset('remain', --count);
});

admin.ready(function (socket) {
	/**
	socket.on('data', function (data) {
		if ( IS_A_NEW_HTTP_REQUEST ) {
			count++;
		}
	});
	*/
	server.connections++;
	server.emit('connection', socket);
});

