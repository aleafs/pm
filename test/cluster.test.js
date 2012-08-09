/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var fs      = require('fs');
var net     = require('net');
var path    = require('path');
var should  = require('should');
var pedding = require('./utils/pedding');
var commonModule = require('../lib/common');
commonModule.debug = function () {};
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
  _client.once('error', function (err) {
    callback(err);
  });
  _client.end(post || '');
};
/* }}} */

/* {{{ private function ProcessIds() */
var ProcessIds  = function(cmd, callback) {
  var command   = require('util').format(
    'ps uxwwww | grep "%s" | grep -v grep | awk \'{print $2}\'', cmd
  );
  require('child_process').exec(command, function(error, stdout) {
    var ids = [];
    stdout.trim().split("\n").forEach(function(pid) {
      pid   = parseInt(pid, 10);
      if (pid > process.pid) {
        ids.push(pid);
      }
    });
    callback(error, ids);
  });
};
/* }}} */

describe('common functions', function() {

  /* {{{ should_listen_at_port_or_socket_works_fine() */
  it('should_listen_at_port_or_socket_works_fine', function(done) {

    var count   = 2;

    /* {{{ connect() */
    var connect = function(handle, message) {
      var res   = new net.Socket({
        'handle'    : handle,
      });
      res.readable  = true;
      res.writeable = true;
      res.resume();
      res.write(message);
    };
    /* }}} */

    var _c1 = require(__dirname + '/../lib/common.js').listen('11234', function(handle, port) {
      port.should.eql(11234);
      connect(handle, 'port');
    });
    var _c2 = require(__dirname + '/../lib/common.js').listen(__dirname + '/a.socket', function(handle, port) {
      port.should.eql(__dirname + '/a.socket');
      connect(handle, 'socket');
    });

    var _me = net.createConnection(__dirname + '/a.socket');
    _me.on('data', function(data) {
      _me.end();
      data.toString().should.eql('socket');
      if ((--count) === 0) {
        _c1.close();
        _c2.close();
        done();
      }
    });

    var _me = net.createConnection(11234);
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
  var statusfile = __dirname + '/status.log';
  var socketfile = __dirname + '/echo.socket';
  var master;
  var existsSync = fs.existsSync || path.existsSync;
  before(function () {
    // existsSync(pidfile) && fs.unlinkSync(pidfile);
    existsSync(statusfile) && fs.unlinkSync(statusfile);
    existsSync(socketfile) && fs.unlinkSync(socketfile);
    master = Cluster.createMaster({
      'pidfile'   : pidfile,
      'statusfile': statusfile,
    });
  });
  after(function (done) {
    // existsSync(pidfile) && fs.unlinkSync(pidfile);
    existsSync(statusfile) && fs.unlinkSync(statusfile);
    existsSync(socketfile) && fs.unlinkSync(socketfile);
    // waiting for process to exit
    setTimeout(done, 1000);
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
    var num = 0;

    var _shutdown   = function() {
      ProcessIds(__dirname + '/fixtures/echo.js', function(error, ids) {
        should.ok(!error);
        ids.should.have.property('length', 1);
        var pid = ids.pop();
        master.reload('echo');

        ProcessIds('/fixtures/echo.js', function(error, ids) {
          should.ok(!error);

          var _list = [];
          ids.forEach(function(id) {
            if (id !== pid) {
              _list.push(id);
            }
          });
          _list.should.have.property('length', 1);
          master.shutdown(function () {
            // wait for process to exit
            setTimeout(function () {
              ProcessIds(__dirname + '/fixtures/echo.js', function(error, ids) {
                ids.should.length(0);
                done(error);
              });
            }, 1000);
          }, 'SIGTERM', 'echo');
        });
      });
    };
    _shutdown = pedding(2, _shutdown);

    master.register('echo', __dirname + '/fixtures/echo.js', {
      'children'    : 1,
      'listen' : [11233, socketfile],
    });

    var _c1 = require('net').createConnection(11233, '127.0.0.1', function() {
      _c1.on('data', function(data) {
        data.toString().should.eql('<- hello');
        _c1.end();
        _shutdown();
      });
      _c1.write('hello');
    });

    var _c2 = require('net').createConnection(socketfile, function() {
      _c2.on('data', function(data) {
        data.toString().should.eql('<- world');
        _c2.end();
        _shutdown();
      });
      _c2.write('world');
    });
  });
  /* }}} */

  /* {{{ should_with_1_http_server_works_fine() */
  it('should_with_1_http_server_works_fine', function(_done) {
    master.register('http1', __dirname + '/fixtures/http.js', {
      'listen'  : [11234],
    });

    var done = pedding(2, function (err) {
      master.shutdown(undefined, 'SIGTERM', 'http1');
      _done(err);
    });

    ProcessIds(__dirname + '/fixtures/http.js', function(error, data) {
      data.should.have.property('length', require('os').cpus().length);
      done();
    });

    // wait process to listen
    setTimeout(function () {
      HttpRequest(11234, '/sdew/dfewf?dfewf', 'aabb=cdef', function(data) {
        data.toString().should.eql(JSON.stringify({
          'url'   : '/sdew/dfewf?dfewf',
          'data'  : 'aabb=cdef',
        }));
        done();
      });
    }, 500);
    
  });
  /* }}} */

  /* {{{ should_exit_and_restart_works_fine() */
  xit('should_exit_and_restart_works_fine', function(done) {
    ProcessIds(__dirname + '/fixtures/echo.js', function(error, ids) {
      should.ok(!error);
      ids.length.should.eql(1);

      var pid1  = ids.pop();
      process.kill(pid1, 'SIGKILL');
      setTimeout(function() {
        ProcessIds('/fixtures/echo.js', function(error, ids) {
          ids.length.should.eql(1);
          ids.pop().should.not.eql(pid1);
          done();
        });
      }, 100);
    });
  });
  /* }}} */

  /* {{{ should_will_not_restart_when_stoped() */
  it('should_will_not_restart_when_stoped', function(done) {
    ProcessIds(__dirname + '/fixtures/echo.js', function(error, ids) {
      ids.length.should.eql(0);
      master.shutdown(function() {}, 'SIGTERM', 'echo');

      setTimeout(function() {
        ProcessIds(__dirname + '/fixtures/echo.js', function(error, ids) {
          should.ok(!error);
          ids.should.have.property('length', 0);
          done();
        });
      }, 100);
    });
  });
  /* }}} */

  /* {{{ should_max_fatal_restart_works_fine() */
  xit('should_max_fatal_restart_works_fine', function(done) {
    var num = 5;

    for (var i = 0; i < num; i++) {
      var _c1 = require('net').createConnection(11233, '127.0.0.1', function() {
        _c1.on('error', function(error) {
          console.log(num);
        });
        _c1.on('data', function(data) {
          if ((--num) === 0) {
            _w1.stop();
            done();
          }
        });
        _c1.write('fatal');
      });
    }
  });
  /* }}} */

});

