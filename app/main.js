/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Master	= require('../lib/cluster.js').create(true);

Master.register(8080, __dirname + '/worker/api.js', 2);
Master.dispatch();

