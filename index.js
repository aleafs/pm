/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

exports.Master  = function(options) {
  return require(__dirname + '/lib/master.js').create(options);
};

exports.Worker  = function() {
  return require(__dirname + '/lib/worker.js').create();
};

