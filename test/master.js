/*!
 * node-cluster - test/master.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var net = require('net');
var fs = require('fs');
var path = require('path');
var should = require('should');
var rewire = require('rewire');
var libpath = process.env.NODE_CLUSTER_COV ? '../lib-cov' : '../lib';
var master = rewire(libpath + '/master');

describe('master.js', function () {

  var common = master.__get__('common');
  var NOTICE = master.__get__('NOTICE');
  var existsSync = fs.existsSync || path.existsSync;
  var pidfile = __dirname + '/test.pid';
  var statusfile = __dirname + '/master_status.log';
  var Master = master.__get__('Master');
  var __WORKERS_LIST = master.__get__('__WORKERS_LIST');
  var processEvents = {};
  var _process = master.__get__('process');
  var _processOn = _process.on;
  var _processKill = _process.kill;
  var child_process = master.__get__('child_process');
  var child_processFork = child_process.fork;
  var MESSAGE = master.__get__('MESSAGE');
  var STATUS = master.__get__('STATUS');

  var lastForkData;
  var childrenCount = 0;
  var childrenEvents = {};
  var childrenSendDatas = {};
  var killedPids = [];

  var lastNOTICE;

  before(function () {
    // existsSync(pidfile) && fs.unlinkSync(pidfile);
    existsSync(statusfile) && fs.unlinkSync(statusfile);
    master.__set__({
      NOTICE: function (msg) {
        lastNOTICE = msg;
      }
    });
    _process.on = function (event, callback) {
      processEvents[event] = callback;
    };
    _process.kill = function (pid, signal) {
      killedPids.push([pid, signal]);
      childrenEvents[pid].exit(0, signal);
      delete childrenEvents[pid];
      delete childrenSendDatas[pid];
    };
    child_process.fork = function (execpath, argv, options) {
      lastForkData = {
        execpath: execpath,
        argv: argv,
        options: options
      };
      childrenCount++;
      var pid = childrenCount;
      var childEvents = childrenEvents[pid] = {};
      var child = {
        pid: pid,
        on: function (event, callback) {
          childEvents[event] = callback;
        },
        send: function (data, handle) {
          childrenSendDatas[pid] = {
            data: data,
            handle: handle
          };
        }
      };

      return child;
    };
  });

  after(function () {
    // existsSync(pidfile) && fs.unlinkSync(pidfile);
    existsSync(statusfile) && fs.unlinkSync(statusfile);
    master.__set__({
      NOTICE: NOTICE
    });
    process.on = _processOn;
    process.kill = _processKill;
    child_process.fork = child_processFork;
  });

  describe('create()', function () {

    var ms;

    it('should return Master singleton instance', function () {
      ms = master.create({
        pidfile: pidfile,
        statusfile: statusfile
      });
      ms.should.be.instanceof(Master);
      ms.should.equal(master.__get__('__GLOBAL_MASTER'));
      master.create({
        pidfile: pidfile,
        statusfile: statusfile
      }).should.equal(ms);
    });

    describe('register()', function () {

      it('should fork 4 http.js children', function () {

        var httpfile = __dirname + '/fixtures/http.js';
        ms.register('http', httpfile, {
          listen: 27150,
          children: 4,
          max_request: 100
        });
        __WORKERS_LIST.should.have.keys('http').with.be.a('object');
        childrenCount.should.equal(4);
        childrenEvents.should.have.keys('1', '2', '3', '4');
      });

      it('should do nothing when get unknow message type', function () {
        for (var pid in childrenEvents) {
          var events = childrenEvents[pid];
          events.message();
          events.message({});
          events.message(1);
          events.message(0);
          events.message({type: 'unknow'});
        }
      });

      it('should save child state when get STATUS message', function () {
        var pid, events, stat;
        for (pid in childrenEvents) {
          events = childrenEvents[pid];
          stat = {
            mem: process.memoryUsage(),
            scores: 0,
            status: STATUS.RUNNING
          };
          events.message({type: MESSAGE.STATUS, data: stat});
          childrenCount.should.equal(4);
          childrenEvents.should.have.keys('1', '2', '3', '4');
        }
      });

      it('should new child and kill old child process when scores > max_request', function (done) {
        var pid, events, stat;
        var count = 4;
        for (pid in childrenEvents) {
          events = childrenEvents[pid];
          stat = {
            mem: process.memoryUsage(),
            scores: 101,
            status: STATUS.RUNNING
          };
          events.message({type: MESSAGE.STATUS, data: stat});
          count++;
          childrenCount.should.equal(count);
        }

        childrenEvents.should.have.keys('4', '5', '6', '7', '8');
        killedPids.should.eql([[1, 'SIGTERM'], [2, 'SIGTERM'], [3, 'SIGTERM']]);

        // check status again, let process 4 kill
        for (pid in childrenEvents) {
          childrenEvents[pid].message({type: MESSAGE.STATUS, data: {
            mem: process.memoryUsage(),
            scores: 1,
            status: STATUS.RUNNING
          }});
        }

        setTimeout(function () {
          childrenEvents.should.have.keys('5', '6', '7', '8');
          killedPids.should.eql([[1, 'SIGTERM'], [2, 'SIGTERM'], [3, 'SIGTERM'], [4, 'SIGTERM']]);
          childrenCount.should.equal(8);
          done();
        }, 50);
      });

      it('should reload fork new 4 children when get RELOAD message', function (done) {
        var count = childrenCount;
        childrenEvents['8'].message({type: MESSAGE.RELOAD, data: {}});
        childrenCount.should.equal(count + 4);
        childrenEvents.should.have.keys('5', '6', '7', '8', '9', '10', '11', '12');
        killedPids.should.eql([[1, 'SIGTERM'], [2, 'SIGTERM'], [3, 'SIGTERM'], [4, 'SIGTERM']]);

        // let worker set a status, set the `._time`
        for (var pid in childrenEvents) {
          childrenEvents[pid].message({type: MESSAGE.STATUS, data: {
            mem: process.memoryUsage(),
            scores: 1,
            status: STATUS.RUNNING
          }});
        }

        setTimeout(function () {
          childrenEvents.should.have.keys('9', '10', '11', '12');
          killedPids.should.eql([
            [1, 'SIGTERM'], [2, 'SIGTERM'], [3, 'SIGTERM'], [4, 'SIGTERM'],
            [5, 'SIGTERM'], [6, 'SIGTERM'], [7, 'SIGTERM'], [8, 'SIGTERM']
          ]);
          childrenCount.should.equal(count + 4);
          done();
        }, 50);
      });

      it('should send message to one group when get SENDTO message', function () {
        childrenSendDatas['9'] = null;
        childrenEvents['9'].message({type: MESSAGE.SENDTO, data: {
          name: 'http'
        }});
        should.not.exist(childrenSendDatas['9']);
        childrenEvents['9'].message({type: MESSAGE.SENDTO, data: {
          name: 'http',
          data: null
        }});

        should.not.exist(childrenSendDatas['9']);
        childrenEvents['9'].message({type: MESSAGE.SENDTO, data: {
          name: 'http',
          data: 'mock data'
        }});
        should.exist(childrenSendDatas['9']);
        childrenSendDatas['9'].data.should.eql({
          type: MESSAGE.COMMAND,
          data: 'mock data',
          from: 'http',
          pid: 9
        });

      });

      it('should worker.on("exit") with code:-1', function (done) {
        ms.once('giveup', function (groupName, times) {
          groupName.should.equal('http');
          times.should.equal(5);
          done();
        });
        childrenEvents['9'].exit(-1);
        childrenEvents['10'].exit(-1);
        childrenEvents['11'].exit(-1);
        childrenEvents['12'].exit(-1);
        childrenEvents['13'].exit(-1);
        // should slice _fatals and keep it <= max_fatal_restart
        childrenEvents['14'].exit(-1);
      });

      it('should Master.reload() success', function () {
        ms.reload();
        ms.reload('http');
      });

      it('should Master.shutdown() success', function (done) {
        ms.shutdown(null, 'SIGTERM', 'notExists');
        ms.shutdown(done, 'SIGTERM');
        // ms.shutdown(done, 'SIGTERM', 'notExists');
        // ms.shutdown(done, 'SIGKILL', 'http');
      });

    });

    describe('process events', function () {

      it('should process.on("exit")', function () {
        processEvents.exit();
        lastNOTICE.should.equal('SIGKILL exited');
      });

      it('should process.on("SIGUSR1")', function () {
        processEvents.SIGTERM();
        lastNOTICE.should.equal('SIGTERM exited');
      });

      it('should process.on("SIGUSR1")', function () {
        processEvents.SIGUSR1();
        lastNOTICE.should.include('Got SIGUSR1, about to reload');
      });

    });

  });

});
