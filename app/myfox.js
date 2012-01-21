/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Master	= require('../lib/master.js').create();

Master.register(8080, '../test/http.js', 1);
Master.dispatch();

