/*!
 * node-cluster - test/worker.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var libpath = process.env.NODE_CLUSTER_COV ? '../lib-cov' : '../lib';
var rewire = require('rewire');
var should = require('should');
var worker = rewire(libpath + '/worker');

describe('worker.js', function () {

  var lastSendData = {};
  var lastInterval = {};
  var lastSetTimeout = {};
  var _send = worker.__get__('_send');
  var STATUS = worker.__get__('STATUS');
  var MESSAGE = worker.__get__('MESSAGE');
  var _setInterval = worker.__get__('setInterval');
  var _setTimeout = worker.__get__('setTimeout');
  var _process = worker.__get__('process');
  var _process_on = _process.on;
  var processEvents = {};
  before(function () {
    processEvents = {};
    lastSendData = {};
    lastInterval = {};
    lastSetTimeout = {};
    _process.on = function (event, callback) {
      processEvents[event] = callback;
    };
    worker.__set__({
      _send: function (type, data) {
        lastSendData = {
          type: type,
          data: data
        };
      },
      setInterval: function (heartbeat, heartbeat_interval) {
        lastInterval = {
          heartbeat: heartbeat,
          heartbeat_interval: heartbeat_interval
        };
      },
      setTimeout: function (callback, terminate_timeout) {
        lastSetTimeout = {
          exit: callback,
          terminate_timeout: terminate_timeout
        };
      },
      process: _process
    });
  });
  after(function () {
    _process.on = _process_on;
    worker.__set__({
      _send: _send,
      setInterval: _setInterval,
      setTimeout: _setTimeout,
      process: _process
    });
  });

  function createMockHandle(close) {
    return {
      readStart: function () {},
      close: close || function () {}
    };
  }

  describe('_send()', function () {
    it('should catch by mock function', function () {
      worker.__get__('_send')('mock type', {name: 'mock name'});
      lastSendData.should.have.keys('type', 'data');
      lastSendData.should.have.property('type', 'mock type');
      lastSendData.should.have.property('data').with.eql({name: 'mock name'});
    });
  });

  describe('_accept()', function () {
    var accept = worker.__get__('_accept');

    it('should return a socket when pass a handle and port to it', function (done) {
      accept(createMockHandle(), 8080, function (socket, port) {
        socket.should.be.a('object');
        port.should.be.equal(8080);
        done();
      });
    });

    it('should not callback when handle is null', function () {
      accept(null, 8080, function (socket, port) {
        throw new Error('should not callback');
      });
    });

    it('should close handle when callback is null', function (done) {
      accept(createMockHandle(done), 8080);
    });

  });

  describe('create()', function () {

    it('should return a worker', function () {
      var wk = worker.create();
      wk.should.have.keys('ready', 'onmessage', 'sendto', 'reload');
    });

  });

  describe('ready()', function () {

    var wk;
    var lastReadyData = {};
    before(function () {
      wk = worker.create({
        heartbeat_interval: 1000000
      });
    });

    it('should heartbeat() once after ready() and status is RUNNING', function () {
      wk.ready(function (socket, port) {
        lastReadyData = {
          socket: socket,
          port: port
        };
      });
      lastInterval.heartbeat_interval.should.equal(30000); // should max to 30 seconds
      lastSendData.type.should.equal(MESSAGE.STATUS);
      lastSendData.data.should.have.keys('status', 'scores', 'mem');
      lastSendData.data.status.should.equal(STATUS.RUNNING);
      lastSendData.data.mem.should.have.keys('rss', 'heapTotal', 'heapUsed');
    });

    it('should sendto() any one', function () {
      wk.sendto('sendtoWho', {name: 'mock sendto data'});
      lastSendData.type.should.equal(MESSAGE.SENDTO);
      lastSendData.data.should.eql({
        name: 'sendtoWho',
        data: {name: 'mock sendto data'}
      });
    });

    it('should send RELOAD message to master after reload(who)', function () {
      wk.reload('reloadFooProcess', {name: 'mock sendto data'});
      lastSendData.type.should.equal(MESSAGE.RELOAD);
      lastSendData.data.should.eql({
        name: 'reloadFooProcess'
      });
    });

    it('should do nothing when on("message") with {} or empty or unknow type', function () {
      processEvents.message();
      processEvents.message({});
      processEvents.message({type: null});
      processEvents.message({type: 'foo'});
    });

    it('should send GET_FD message to master when get a WAKEUP message', function () {
      processEvents.message({type: MESSAGE.WAKEUP});
      lastSendData.type.should.equal(MESSAGE.GET_FD);
      should.not.exist(lastSendData.data);
    });

    it('should accept(handle, port, callback) and send GET_FD to master when get a REQ_FD message and request queue not empty', function (done) {
      lastSendData = null;
      processEvents.message({type: MESSAGE.REQ_FD, port: 8080, data: 1}, createMockHandle(function () {
        throw new Error('should not call close() method');
      }));
      lastReadyData.port.should.equal(8080);
      lastReadyData.socket.should.be.a('object');
      process.nextTick(function () {
        should.exist(lastSendData);
        lastSendData.type.should.equal(MESSAGE.GET_FD);
        should.not.exist(lastSendData.data);
        done();
      });
    });

    it('should accept(handle, port, callback) and change to waiting when get a REQ_FD message and request queue is empty', function (done) {
      lastSendData = null;
      processEvents.message({type: MESSAGE.REQ_FD, port: 8080, data: 0}, createMockHandle(function () {
        throw new Error('should not call close() method');
      }));
      lastReadyData.port.should.equal(8080);
      lastReadyData.socket.should.be.a('object');
      process.nextTick(function () {
        should.not.exist(lastSendData);
        done();
      });
    });

    it('should direct listen a port when get a LISTEN message', function (done) {
      var _listen = worker.__get__('listen');
      worker.__set__({
        listen: function (addr, callback) {
          process.nextTick(function () {
            callback(createMockHandle(), addr);
          });
          return createMockHandle();
        }
      });

      lastReadyData = null;
      processEvents.message({type: MESSAGE.LISTEN, data: 80});
      process.nextTick(function () {
        should.exist(lastReadyData);
        lastReadyData.port.should.equal(80);
        lastReadyData.socket.should.be.a('object');
        done();
      });
      worker.__set__({
        listen: _listen
      });
    });

    it('should call onmsg callback when get a COMMAND message', function (done) {
      wk.onmessage(); // clean the onmsg list
      wk.onmessage(function (data, from, pid) {
        arguments.should.length(3);
        data.should.eql({name: 'some message name', count: 1});
        from.should.equal('mock from value');
        pid.should.equal(9493);
        done();
      });
      processEvents.message({
        type: MESSAGE.COMMAND, 
        data: {name: 'some message name', count: 1},
        from: 'mock from value',
        pid: 9493
      });
    });

    it('should on("SIGTERM") close openning fd list', function () {
      processEvents.SIGTERM();
      lastSetTimeout.terminate_timeout.should.equal(1000); // default terminate_timeout is 1000 ms
      lastSetTimeout.exit.toString().should.include('process.exit(0);');
    });
  });

});