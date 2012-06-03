/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Master  = require(__dirname + '/../').Master({
  'pidfile' : __dirname + '/bench.pid',
});

var server  = Master.register('http', __dirname + '/fixtures/http.js', {
  'children'    : 4,
    'listen'    : 7751,
});
