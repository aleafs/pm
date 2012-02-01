/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Master  = require('../lib/cluster.js').Master;

var app  = new Master();

app.register(
  /**
   * @需要监听的端口 (required)
   * @你也可以填入一个非数字，作为一个不对外服务的常驻进程，干点别的事情
   */
  8080,

  /**
   * @worker 的路径 (required)
   */
  __dirname + '/worker/api.js', 

  /**
   * @起多少个进程, 默认为系统CPU数 (optional)
   */
  null, 

  /**
   * @找不到可用worker时返回的消息体, 默认为HTTP协议的410消息 (optional)
   */
  '<!--ERROR-->', 

  /**
   * @单个worker处理多少次请求后退出, 默认-1, 表示不启用这个功能 (optional)
   */
  1
);

app.register(33749, __dirname + '/worker/admin.js', 1, null, -1);
app.dispatch();
