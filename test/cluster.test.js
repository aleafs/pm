/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var fs      = require('fs');
var net     = require('net');
var should  = require('should');
var Cluster = require(__dirname + '/../');

describe('common functions', function() {

  /* {{{ should_listen_at_port_works_fine() */
  xit('should_listen_at_port_works_fine', function(done) {

    var count   = 2;

    /* {{{ connect() */
    var connect = function(handle) {
      var res   = new require('net').Socket({
        'handle'    : handle,
      });
      res.readable  = true;
      res.writeable = true;
      res.resume();
      res.write('hello ->' + count);
    };
    /* }}} */

    require(__dirname + '/../lib/common.js').listen(11234, connect);
    require(__dirname + '/../lib/common.js').listen(__dirname + '/a.socket', connect);
    var _me = require('net').createConnection(__dirname + '/a.socket', function() {
      console.log('aa');
    });
    _me.on('data', function(data) {
      console.log(data);
      _me.end();
      done();
    });
  });
  /* }}} */

});

describe('node-cluster v2.0.0-alpha', function() {

  var pidfile   = __dirname + '/test.pid';

  /* {{{ should_master_create_pidfile_works_fine() */
  it('should_master_create_pidfile_works_fine', function(done) {

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
    _me.register('http1', __dirname + '/fixtures/http.js', {
      'children'    : 1,
      'listen'      : [11233],
    });
    _me.dispatch();
    done();
    return;
    var client  = net.createConnection(11233, function() {
      console.log('aa');
      client.write('');
      _me.shutdown('http1');
      done();
    });
  });
  /* }}} */

});

