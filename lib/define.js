/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

/**
 * @进程状态机
 */
exports.STATUS  = {
  'PENDING' : 0,        /**<    准备状态    */
  'RUNNING' : 1,        /**<    可接受服务  */
  'STOPING' : 2,        /**<    准备关闭    */
};

