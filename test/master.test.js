/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var rewire = require('rewire');
var should = require('should');
var common = require(__dirname + '/mock.js');
var master = rewire(__dirname + '/../lib/master.js');

var PROCESS;
var ___messages = [];
beforeEach(function () {
  PROCESS = common.mockProcess();
  PROCESS.makesureCleanAllMessage();
  PROCESS.__getOutMessage().should.eql([]);
  PROCESS.__getEvents().should.eql([]);

  ___messages = [];
  master.__set__({
    'PROCESS' : PROCESS,
    'fork'  : function () {
      ___messages.push(arguments);
    },
  });
});

describe('master', function () {

  it('', function () {
    var _me = master.create();
    _me.shutdown();
    PROCESS.emit('SIGUSR1');
  });

});
