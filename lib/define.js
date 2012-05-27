/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

/**
 * @进程状态机
 */
exports.STATUS  = {
  'PENDING' : 0,        /**<    准备状态    */
  'RUNNING' : 1,        /**<    可接受服务  */
  'STOPING' : 2,        /**<    准备关闭    */
};

/**
 * @消息类型
 */
exports.MESSAGE = {
  'GET_FD'  : 11,       /**<    获取句柄 (worker -> master) */
  'REQ_FD'  : 12,       /**<    请求句柄 (master -> worker) */
  'WAKEUP'  : 14,       /**<    唤醒消息 (master -> worker) */
  'LISTEN'  : 16,       /**<    监听端口 (master -> worker) */
  'STATUS'  : 21,       /**<    状态报告 (worker -> master) */
  'SENDTO'  : 31,       /**<    转发消息 (worker -> master) */
  'COMMAND' : 32,       /**<    命令消息 (master -> worker) */
};

