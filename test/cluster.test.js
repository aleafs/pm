/*!
 * node-cluster - test/cluster.test.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

if (process.env.JSCOV) {
  var jscover = require('jscoverage');
  require = jscover.require(module);
  require(__dirname + '/../lib/cluster.js', true);
  process.on('exit', jscover.coverage);
}

var should  = require('should');
var cluster = require('../');

describe('lib/cluster', function() {
  var master = cluster.Master({
    'pidfile'   : __dirname + '/my.pid',
  });
  before(function(done) {
    master.register(37211, __dirname + '/support/app.js');
    master.register(37212, __dirname + '/support/app.js', {
      cnum: 1,
      args: ['a', '-b 1', '--debug']
    });
    master.register(37213, __dirname + '/support/app.js', {
      cnum: 3,
      user: 'nobody',
    });
    master.register([ 37214, 37215 ], __dirname + '/support/multi_port.js', { cnum: 2 });
    master.dispatch();
    setTimeout(done, 1000);
  });

  describe('fork worker right', function() {
    it('fork cpu num children when child number not set', function() {
      var pids = Object.keys(master.heartmsg[37211]);
      pids.length.should.equal(require('os').cpus().length);
    });

    it('fork 1, 3, 2 children', function() {
      Object.keys(master.heartmsg[37212]).length.should.equal(1);
      Object.keys(master.heartmsg[37213]).length.should.equal(3);
      Object.keys(master.heartmsg[37214]).length.should.equal(2);
    });
  });

  describe('http worker', function() {
    it('GET', function(done) {
      master.request(37211).get('/').end(function(res) {
        res.should.status(200);
        res.headers.should.have.property('content-type', 'text/plain;charset=utf-8');
        res.body.toString().should.equal('GET /');
        done();
      });
    });

    it('POST', function(done) {
      master.request(37213).post('/foo')
      .write('?foo=bar&abc=def')
      .end(function(res) {
        res.should.status(200);
        res.headers.should.have.property('content-type', 'text/plain;charset=utf-8');
        res.body.toString().should.equal('POST /foo?foo=bar&abc=def');
        done();
      });
    });

    it('GET port 37214', function(done) {
      master.request(37214).get('/').end(function(res) {
        res.should.status(200);
        res.headers.should.have.property('content-type', 'text/plain;charset=utf-8');
        res.body.toString().should.equal('hello world, handle port 37214');
        done();
      });
    });

    it('GET port 37215', function(done) {
      master.request(37215).get('/37215').end(function(res) {
        res.should.status(200);
        res.headers.should.have.property('content-type', 'text/plain;charset=utf-8');
        res.body.toString().should.equal('hello world, handle port 37215');
        done();
      });
    });

    /* {{{ should_register_worker_with_args_works_fine() */
    it('should_register_worker_with_args_works_fine', function(done) {
      master.request(37212).get('/print_args').end(function(res) {
        var arg = JSON.parse(res.body.toString().split("\r\n\r\n").pop().trim());
        arg.pop().should.eql('--debug');
        arg.pop().should.eql('-b 1');
        arg.pop().should.eql('a');
        done();
      });
    });
    /* }}} */

  });

  after(function() {
    master.close();
  });

});
