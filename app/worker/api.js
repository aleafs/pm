/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var api	= require(__dirname + '/../../lib/cluster.js').create();

api.ready(function (socket) {
	socket.end('<!--STATUS OK-->\n');
	api.release();
});

