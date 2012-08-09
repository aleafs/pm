/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

exports.MAX_HEARTBEAT_INTERVAL = 30000;

/**
 * @进程状态机
 */
exports.STATUS  = {
  'UNKNOWN' : 0,        /**<    未知状态    */
  'PENDING' : 1,        /**<    准备状态    */
  'RUNNING' : 2,        /**<    可接受服务  */
  'STOPING' : 3,        /**<    准备关闭    */
};

/**
 * @消息类型
 */
exports.MESSAGE = {
  'REQ_FD'  : 12,       /**<    请求句柄 (master -> worker) */
  'LISTEN'  : 16,       /**<    监听端口 (master -> worker) */
  'STATUS'  : 21,       /**<    状态报告 (worker -> master) */
  'RELOAD'  : 23,       /**<    重载进程 (worker -> master) */
  'SENDTO'  : 31,       /**<    转发消息 (worker -> master) */
  'COMMAND' : 32,       /**<    命令消息 (master -> worker) */
};

/**
 * @打印日志
 */
exports.debug   = function (name, message) {
  console.log('[' + (name || 'unknown') + ':' + process.pid + '][' + new Date() + '] ' + message);
};

/**
 * @监听端口或者socket
 */
/* {{{ public function listen() */

var __tcpError  = function (name, message) {
  var error = new Error(message || 'unknown');
  error.name    = name;
  return error;
};

var TCP  = process.binding('tcp_wrap').TCP;
var Pipe = process.binding('pipe_wrap').Pipe;
exports.listen  = function (portOrSock, connection) {
  portOrSock = /^\d+$/.test(portOrSock) ? Number(portOrSock) : portOrSock;
  var _me;
  var ret;
  if (typeof portOrSock === 'number') {
    _me = new TCP();
    ret = _me.bind('0.0.0.0', portOrSock);
  } else {
    _me = new Pipe();
    ret = _me.bind(portOrSock);
  }

  if (ret) {
    // if `ret` is not zero, bind error.
    _me.close();
    _me = null;
    throw __tcpError('BIND', 'Can not bind to ' + portOrSock);
  }

  if (_me.listen(1023)) {
    _me.close();
    _me = null;
    throw __tcpError('LISTEN', 'Can not listen at ' + portOrSock);
  }

  _me.onconnection  = function (handle) {
    connection(handle, portOrSock);
  };
  return _me;
};
/* }}} */

