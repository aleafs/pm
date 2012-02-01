/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Master  = require('../lib/cluster.js').Master;

app  = new Master();

app.register(8080, __dirname + '/worker/api.js', null, null, 1);
app.register(33749, __dirname + '/worker/admin.js', 1, '<!--ERROR-->\r\n', 1000);
app.dispatch();

