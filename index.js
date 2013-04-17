/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var libdir = process.env.PM_COV ? './lib-cov' : './lib';
var master = require(libdir + '/master.js');
var worker = require(libdir + '/worker.js');

/**
 * Create a `Master`.
 * @param {Object} options
 *  - {String} [pidfile]
 *  - {String} [statusfile]
 * @return {Master} the master instance.
 * @api public
 */
exports.createMaster = function (options) {
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
exports.createWorker = function (options) {
  return worker.create(options);
};

