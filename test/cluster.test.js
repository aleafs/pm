/*!
 * node-cluster - test/cluster.test.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var should = require('should');
var cluster = require('../');

describe('lib/cluster', function() {
  var master = cluster.Master();
  before(function(done) {
    master.register(37211, __dirname + '/support/app.js');
    master.register(37212, __dirname + '/support/app.js', {
		'cnum'	: 1,
	});
    master.register(37213, __dirname + '/support/app.js', {
		'cnum'	: 3,
		'user'	: 'nobody',
	});
    master.dispatch();
    setTimeout(done, 1000);
  });

  describe('fork worker right', function() {
    it('fork cpu num children when child number not set', function() {
      var pids = Object.keys(master.heartmsg[37211]);
      pids.length.should.equal(require('os').cpus().length);
    });

    it('fork 1 and 3 children', function() {
      Object.keys(master.heartmsg[37212]).length.should.equal(1);
      Object.keys(master.heartmsg[37213]).length.should.equal(3);
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
  });

  after(function() {
    process.kill(process.pid, 'SIGTERM');
  });

});
