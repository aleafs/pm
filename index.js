/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

module.exports = require(__dirname + (
  process.env.JSCOV ? '/lib-cov/cluster.js' : '/lib/cluster.js'
));

