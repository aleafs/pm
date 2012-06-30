/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var libpath = process.env.NODE_CLUSTER_COV ? './lib-cov' : './lib';
var master = require(libpath + '/master.js');
var worker = require(libpath + '/worker.js');

/**
 * Create a `Master`.
 * @param {Object} options
 *  - {String} [pidfile]
 *  - {String} [statusfile]
 * @return {Master} the master instance.
 * @api public
 */
exports.Master = function (options) {
  return master.create(options);
};

/**
 * Create a `Worker`.
 * @param {Object} options
 *  - {Number} [heartbeat_interval], heartbeat interval ms, default is `2000` ms.
 *  - {Number} [terminate_timeout], terminate timeout ms, default is `1000` ms.
 * @return {Worker} this worker instance.
 * @api public
 */
exports.Worker = function (options) {
  return worker.create(options);
};

