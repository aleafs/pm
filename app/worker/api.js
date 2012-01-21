/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var api	= require(__dirname + '/../../lib/worker.js').create();

api.ready(function (handle) {
	handle.close();
	api.release();
});

