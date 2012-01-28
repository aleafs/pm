/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Master	= require('../lib/cluster.js').Master;

app	= new Master();

app.register(8080, __dirname + '/worker/api.js', 1);
app.register(8000, __dirname + '/worker/admin.js', 1, 10, 'hello world\r\n');
app.dispatch();

