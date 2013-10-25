/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var mm = require('mm');
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
fs.existsSync = fs.existsSync || path.existsSync;
var should = require('should');
var common = require(__dirname + '/mock.js');
var Child = require('../lib/child.js');

describe('child manager', function () {

  var PROCESS;
  beforeEach(function () {

    common.resetAllStatic();

    PROCESS = common.mockProcess();
    PROCESS.makesureCleanAllMessage();
    PROCESS.__getOutMessage().should.eql([]);
    PROCESS.__getEvents().should.eql([]);

    var sub = common.mockFork();
    sub.makesureCleanAllMessage;
    Child.mock(PROCESS);
    mm(child_process, 'fork', common.mockFork);
  });

  afterEach(function () {
    mm.restore();
  });

  /* {{{ should_public_method_works_fine() */
  it('should_public_method_works_fine', function (_done) {
    var sock = __dirname + '/' + process.version + '.a.socket';
    if (fs.existsSync(sock)) {
      fs.unlinkSync(sock);
    }
    var _me = Child.create(['filename.js', 'b'], {
      'listen' : sock + ',,33047', 
      'children' : 3,
    });

    var _messages = [];
    _me.on('fork', function (pid) {
      _messages.push(['fork', pid]);
    });
    _me.on('broadcast', function (who, msg, by) {
      _messages.push(['broadcast', who, JSON.stringify(msg), by]);
    });

    var done = function () {
      _messages.should.eql([
        ['fork', 1],
        ['fork', 2],
        ['fork', 3],
        ['fork', 4],
        ['fork', 5],
        ['fork', 6],
        ['broadcast', 'FBX', '"fuck"', 1],
        ]);
      _done();
    };

    common.resetAllStatic();

    var one = _me._fork();
    one.__getArguments().should.eql({
      '0' : 'filename.js',
      '1' : ['b'],
      '2' : {
        'cwd' : __dirname, 
        'env' : {
          'test-env' : 'lalal',
          PM_WORKER_INDEX: 0
        }
      }
    });

    _me.start();
    _me.running.should.eql(1);
    Object.keys(_me.pstatus).should.eql(['1', '2', '3']);

    _me.reload();
    _me.start();
    Object.keys(_me.dielist).should.eql(['1', '2', '3']);
    Object.keys(_me.pstatus).should.eql(['1', '2', '3', '4', '5', '6']);

    _me.broadcast(['world'], 'Obama', -1);

    var expects = [];
    for (var i = 1; i < 7; i++) {
      expects.push(JSON.stringify([i, {
        'type' : 'hello',
        'data' : ['world'],
        'from' : 'Obama',
        '_pid' : -1,
      }, null]));
    }
    one.__getGlobalMessage().should.eql(expects);

    one.emit('message');
    one.emit('message', {'data' : 1});

    /**
     * @ 心跳信息
     */
    one.emit('message', {'type' : 'heartbeat', 'data' : {'aa' : 1}});
    _me.pstatus['1'].should.have.property('aa', 1);
    _me.pstatus['1'].should.have.property('_time');

    /**
     * @ 请求广播
     */
    one.emit('message', {'type' : 'broadcast', 'data' : {'who' : 'FBX'}});
    one.emit('message', {'type' : 'broadcast', 'data' : {'who' : 'FBX', 'msg' : 'fuck'}});

    one.__getOutMessage().pop();

    /**
     * @ 请求句柄
     */
    one.emit('message', {'type' : 'ready'});
    one.__getOutMessage().pop()[0].should.eql({'type' : 'listen', 'data' : 33047});

    /**
     * @ 模拟两个进程ready，dielist应该至少杀掉2个
     */
    one.emit('message', {'type' : 'ready'});
    setTimeout(function () {
      Object.keys(_me.dielist).length.should.below(2);
      Object.keys(_me.pstatus).should.eql(['4', '5', '6']);
      _me.stop();
      _me.running.should.eql(0);
      done();
    }, 10);
  });
  /* }}} */

  /* {{{ should_killall_child_when_exit() */
  it('should_killall_child_when_exit', function (done) {
    var _me = Child.create(['filename.js', 'b'], {
      'children' : 3,
    });

    common.resetAllStatic();

    _me.start();
    _me.reload();
    Object.keys(_me.dielist).should.eql(['1','2','3']);

    var one = _me._fork();
    one.emit('ready');
    setTimeout(function () {
      Object.keys(_me.dielist).should.eql(['1','2','3']);
      _me.stop();

      setTimeout(function () {
        Object.keys(_me.dielist).should.eql([]);
        done();
      }, 10);
    }, 10);
  });
  /* }}} */

  /**
   * XXX: 这个case逻辑上还有点问题
   */
  /* {{{ should_max_fatals_works_fine() */
  it('should_max_fatals_works_fine', function (done) {

    common.resetAllStatic();

    var _me = Child.create(['a'], {
      'listen' : null, 'max_fatal_restart' : 2, 'pause_after_fatal' : 10,
      'children' : 0
    });

    var _messages = [];
    _me.on('giveup', function (n, p) {
      n.should.eql(2);
      p.should.eql(10);
      _messages.push(['giveup', n, p]);
    });
    _me.on('fork', function (pid) {
      _messages.push(['fork', pid]);
    });

    var one = _me._fork();
    _messages.should.eql([['fork', 1]]);

    _me.start();

    var cpu = require(__dirname + '/../lib/os.js').cpusnum();
    Object.keys(_me.pstatus).should.have.property('length', cpu);

    /**
     * exit cases:
     * 0, sigterm : [-] fork 0
     * 0, sigkill : [!] fork 1
     * 1, sigterm : [!] fork 2
     * 1, sigkill : [!] pause
     */
    for (var i = 0; i < 2; i++) {
      ['SIGTERM', 'SIGKILL'].forEach(function (s) {
        one.emit('exit', i, s);
      });
    }

    var expects = [];
    for (var i = 0; i < cpu; i++) {
      expects.push(['fork', 1 + i]);
    }

    expects.push(['fork', i++]);

    setTimeout(function () {
      //_messages.should.eql(expects);
      done();
    }, 50);
  });
  /* }}} */

  /* {{{ should_serial_mode_works_fine() */
  it('should_serial_mode_works_fine', function (done) {
    var _me = Child.create(['filename.js', 'b'], {
      'children' : 3,
      'use_serial_mode': true
    });

    common.resetAllStatic();

    var one = _me._fork();
    one.__getArguments().should.eql({
      '0' : 'filename.js',
      '1' : ['b'],
      '2' : {
        'cwd' : __dirname, 'env' : {'test-env' : 'lalal', PM_WORKER_INDEX: 0}
      }
    });

    _me.start();
    _me.running.should.eql(1);
    Object.keys(_me.pstatus).should.eql(['1', '2', '3']);

    // 测试串行启动模式，主进程的两个初始值 
    _me.tokenPid.should.eql(-1);
    _me.tokenCount.should.eql(0);

    one.emit('message', {
      cmd : 'token_get', 
      pid : one.pid
    });

    _me.tokenPid.should.eql(one.pid);
    _me.tokenCount.should.eql(1);

    one.emit('message', {
      cmd : 'token_get', 
      pid : one.pid
    });

    one.emit('message', {
      cmd : 'token_release', 
      pid : one.pid
    });

    _me.tokenPid.should.eql(-1);
    _me.tokenCount.should.eql(1);

    // 测试发送令牌后，子进程异常退出的情况
    one.emit('message', {
      cmd : 'token_get', 
      pid : one.pid
    });

    _me.tokenPid.should.eql(one.pid);
    _me.tokenCount.should.eql(2);

    one.emit('exit');

    _me.tokenPid.should.eql(-1);

    done();
  });
  /* }}} */

});

