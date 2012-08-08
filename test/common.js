/*!
 * node-cluster - test/common.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var should = require('should');
var libpath = process.env.NODE_CLUSTER_COV ? '../lib-cov' : '../lib';
var rewire = require('rewire');
var common = rewire(libpath + '/common');

describe('common.js', function () {

  it('debug() should print log into console', function () {
    common.debug(null, 'test log');
    common.debug('mockname', 'test log');
  });

  describe('listen()', function () {

    var TCP = common.__get__('TCP');
    var Pipe = common.__get__('Pipe');
    var localSock = __dirname + '/common.sock';
    var existsSync = fs.existsSync || path.existsSync;
    beforeEach(function () {
      existsSync(localSock) && fs.unlinkSync(localSock);
    });
    afterEach(function () {
      existsSync(localSock) && fs.unlinkSync(localSock);
    });

    it('should return tcp object when listen at number port', function (done) {
      var tcp = common.listen(20461, function (handle, port) {
        handle.should.equal('mock handle');
        port.should.equal(20461);
        tcp.close();
        done();
      });
      should.exist(tcp);
      should.ok(tcp instanceof TCP);
      tcp.onconnection('mock handle');
    });

    it('should return tcp object when listen at string number port', function (done) {
      var tcp = common.listen('20461', function (handle, port) {
        handle.should.equal('mock handle 20461');
        port.should.equal(20461);
        tcp.close();
        done();
      });
      should.exist(tcp);
      should.ok(tcp instanceof TCP);
      tcp.onconnection('mock handle 20461');
    });

    it('should throw error when listen at 80 no perm', function () {
      (function () {
        var tcp = common.listen('80', function (handle, port) {});
      }).should.throw('Can not bind to 80');
    });

    it('should return Pipe object when listen at local sock', function (done) {
      var pipe = common.listen(localSock, function (handle, port) {
        handle.should.equal('mock pipe handle');
        port.should.equal(localSock);
        pipe.close();
        done();
      });
      should.exist(pipe);
      should.ok(pipe instanceof Pipe);
      pipe.onconnection('mock pipe handle');
    });

    it('should throw error when listen at /tmp', function () {
      (function () {
        common.listen('/tmp', function (handle, port) {});
      }).should.throw('Can not bind to /tmp');
    });

    describe('mock listen() error', function () {

      var _listen = TCP.prototype.listen;
      beforeEach(function () {
        TCP.prototype.listen = function () {
          return -1;
        };
      });
      afterEach(function () {
        TCP.prototype.listen = _listen;
      });

      it('should throw listen error', function () {
        (function () {
        var tcp = common.listen(8080, function (handle, port) {});
      }).should.throw('Can not listen at 8080');
      });

    });

  });

});