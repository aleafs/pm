/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var should  = require('should');
var Cluster = require(__dirname + '/../');

describe('cluster interface', function () {

  it('should_master_interface_works_fine', function () {
    var _me = Cluster.Master();
  });

});
