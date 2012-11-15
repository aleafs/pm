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
      'listen' : '0', 'children' : 3,
    });

    var _messages = [];
    _me.on('fork', function (pid) {
      _messages.push(['fork', pid]);
    });

    var done = function () {
      _messages.should.eql([
        ['fork', 1],
        ['fork', 2],
        ['fork', 3],
        ['fork', 4],
        ['fork', 5],
        ['fork', 6],
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
    done();
  });

});

