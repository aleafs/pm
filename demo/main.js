/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Master = require('../lib/cluster.js').Master;

var app = new Master({
  'max_fatal_restart'   : 2,
  'restart_time_window' : 60
});

app.register(
  /**
   * @需要监听的端口 (required)
   * @你也可以填入一个非数字，作为一个不对外服务的常驻进程，干点别的事情
   */
  8080,

  /**
   * @worker 的路径 (required)
   */
  __dirname + '/worker/echo.js', 
  
  {
    /**
     * @起多少个进程, 默认为系统CPU数 (optional)
     */
    'cnum'  : null,

    /**
     * @找不到可用worker时返回的消息体, 默认为HTTP协议的410消息
     */
    'gone'  : '<!--ERROR-->',

    /**
     * @单个worker处理多少次请求后退出, 默认-1, 表示不启用这个功能
     */
    'maxc'  : 1,

    /**
     * @worker进程的工作用户组，默认null，表示以master的启动用户组进行运行 (仅root下有效)
     */
    'group' : 'nobody',

    /**
     * @worker进程的工作用户，默认null，表示以master的启动用户进行运行 (仅root下有效)
     */
    'user'  : 'nobody'
  }

);
app.register(33749, __dirname + '/worker/http.js', { 'cnum': 1 });
app.register([ 33750, 33751 ], __dirname + '/worker/multi_port_http.js', { 'cnum': 2 }); // listen 2 different port
app.dispatch();
