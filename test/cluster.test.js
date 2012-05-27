/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var fs      = require('fs');
var should  = require('should');
var Cluster = require(__dirname + '/../');

describe('cluster interface', function () {

  /* {{{ should_master_create_pidfile_works_fine() */
  it('should_master_create_pidfile_works_fine', function (done) {

    var pid = __dirname + '/test.pid';
    var _me = Cluster.Master({
      'pidfile' : pid,
    });
    _me.dispatch();
    setTimeout(function() {
      fs.readFile(pid, 'utf-8', function(error, data) {
        should.ok(!error);
        parseInt(data, 10).should.eql(process.pid);
        done();
      });
    }, 20);
  });
  /* }}} */

});
