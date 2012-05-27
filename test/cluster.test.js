/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var fs      = require('fs');
var should  = require('should');
var Cluster = require(__dirname + '/../');

describe('node-cluster v2.0.0-alpha', function () {

  var pidfile   = __dirname + '/test.pid';

  /* {{{ should_master_create_pidfile_works_fine() */
  it('should_master_create_pidfile_works_fine', function (done) {

    var _me = Cluster.Master({
      'pidfile' : pidfile,
    });
    _me.dispatch();
    setTimeout(function() {
      fs.readFile(pidfile, 'utf-8', function(error, data) {
        should.ok(!error);
        parseInt(data, 10).should.eql(process.pid);
        done();
      });
    }, 20);
  });
  /* }}} */

  /* {{{ should_with_1_http_server_works_fine() */
  it('should_with_1_http_server_works_fine', function(done) {
    var _me = Cluster.Master({
      'pidfile' : pidfile,
    });
    _me.register('http1', __dirname + '/fixtures/http.js');
    _me.dispatch();
    done();
  });
  /* }}} */

});

