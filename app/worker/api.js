/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Worker	= require(__dirname + '/../../lib/cluster.js').Worker;

api	= new Worker();
api.ready(function (socket) {
	socket.end('<!--STATUS OK-->\n');
	api.release();
});

