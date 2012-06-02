/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var fs      = require('fs');
var net     = require('net');
var should  = require('should');
var Cluster = require(__dirname + '/../');

/* {{{ private function HttpRequest() */
var HttpRequest = function(port, url, post, callback) {
  var options = {
    'host'  : '127.0.0.1',
    'port'  : port,
    'path'  : url,
    'method'    : post ? 'POST' : 'GET',
    'headers'   : {},
  };

  if (post) {
    options.headers['Content-Length'] = post.length;
  }
  var _client = require('http').request(options, function(res) {
    var chunk = '';     // ignore multibytes charactors
    res.on('data', function(data) {
      chunk += data;
    });
    res.on('end', function() {
      callback(chunk);
    });
  });
  _client.end(post || '');
};
/* }}} */

describe('common functions', function() {

  /* {{{ should_listen_at_port_or_socket_works_fine() */
  it('should_listen_at_port_or_socket_works_fine', function(done) {

    var count   = 2;

    /* {{{ connect() */
    var connect = function(handle, message) {
      var res   = new require('net').Socket({
        'handle'    : handle,
      });
      res.readable  = true;
      res.writeable = true;
      res.resume();
      res.write(message);
    };
    /* }}} */

    var _c1 = require(__dirname + '/../lib/common.js').listen(11234, function(handle) {
      connect(handle, 'port');
    });
    var _c2 = require(__dirname + '/../lib/common.js').listen(__dirname + '/a.socket', function(handle) {
      connect(handle, 'socket');
    });

    var _me = require('net').createConnection(__dirname + '/a.socket');
    _me.on('data', function(data) {
      _me.end();
      data.toString().should.eql('socket');
      if ((--count) === 0) {
        _c1.close();
        _c2.close();
        done();
      }
    });

    var _me = require('net').createConnection(11234);
    _me.on('data', function(data) {
      _me.end();
      data.toString().should.eql('port');
      if ((--count) === 0) {
        _c1.close();
        _c2.close();
        done();
      }
    });
  });
  /* }}} */

});

describe('node-cluster v2.0.0-alpha', function() {

  var pidfile   = __dirname + '/test.pid';
  var master    = Cluster.Master({
    'pidfile'   : pidfile,
  });

  /* {{{ should_master_create_pidfile_works_fine() */
  it('should_master_create_pidfile_works_fine', function(done) {
    setTimeout(function() {
      fs.readFile(pidfile, 'utf-8', function(error, data) {
        should.ok(!error);
        parseInt(data, 10).should.eql(process.pid);
        done();
      });
    }, 20);
  });
  /* }}} */

  /* {{{ should_echo_service_with_master_works_fine() */
  it('should_echo_service_with_master_works_fine', function(done) {
    var _w1 = master.register('echo', __dirname + '/fixtures/echo.js', {
      'children'    : 1,
        'listen' : [11233, __dirname + '/echo.socket'],
    });

    var num = 2;
    var _c1 = require('net').createConnection(11233, '127.0.0.1', function() {
      _c1.on('data', function(data) {
        data.toString().should.eql('<- hello');
        _c1.end();
        if ((--num) === 0) {
          _w1.stop();
          done();
        }
      });
      _c1.write('hello');
    });

    var _c2 = require('net').createConnection(__dirname + '/echo.socket', function() {
      _c2.on('data', function(data) {
        data.toString().should.eql('<- world');
        _c2.end();
        if ((--num) === 0) {
          _w1.stop();
          done();
        }
      });
      _c2.write('world');
    });
  });
  /* }}} */

  /* {{{ should_with_1_http_server_works_fine() */
  it('should_with_1_http_server_works_fine', function(done) {

    var _w2 = master.register('http1', __dirname + '/fixtures/http.js', {
      'children'    : 1,
        'listen'      : [11233],
    });

    HttpRequest(11233, '/sdew/dfewf?dfewf', 'aabb=cdef', function(data) {
      data.toString().should.eql(JSON.stringify({
        'url'   : '/sdew/dfewf?dfewf',
        'data'  : 'aabb=cdef',
      }));
      _w2.stop();
      done();
    });
  });
  /* }}} */

});

