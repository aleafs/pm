/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var rewire = require('rewire');
var should = require('should');
var common = require(__dirname + '/mock.js');

var Child = rewire(__dirname + '/../lib/child.js');

var PROCESS;
beforeEach(function () {

  common.resetAllStatic();

  PROCESS = common.mockProcess();
  PROCESS.makesureCleanAllMessage();
  PROCESS.__getOutMessage().should.eql([]);
  PROCESS.__getEvents().should.eql([]);

  var sub = common.mockFork();
  sub.makesureCleanAllMessage;
  Child.__set__({
    'PROCESS' : PROCESS,
    'fork'  : common.mockFork,
  });
});

describe('child manager', function () {

  it('should_public_method_works_fine', function (_done) {
    var _me = Child.create(['filename.js', 'b'], {
      'listen' : __dirname + '/a.socket,,0', 'children' : 3,
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
        'cwd' : __dirname, 'env' : {'test-env' : 'lalal'}
      }
    });

    _me.start();
    _me.running.should.eql(1);
    Object.keys(_me.pstatus).should.eql(['1', '2', '3']);

    _me.reload();
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

    /**
     * @ 请求句柄
     */
    one.emit('message', {'type' : 'ready'});

    setTimeout(function () {
      //Object.keys(_me.dielist).should.eql(['2', '3']);
      _me.stop();
      _me.running.should.eql(0);
      done();
    }, 10);
  });

});

