/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var rewire = require('rewire');
var should = require('should');
var common = require(__dirname + '/mock.js');
var master = rewire(__dirname + '/../lib/master.js');

var PROCESS;
beforeEach(function () {
  common.resetAllStatic();
  PROCESS = common.mockProcess();
  PROCESS.makesureCleanAllMessage();
  PROCESS.__getOutMessage().should.eql([]);
  PROCESS.__getEvents().should.eql([]);

  master.__set__({
    'PROCESS' : PROCESS,
    'CreateChild' : common.mockChild,
  });
});

describe('master', function () {

  it('should_public_api_works_fine', function () {
    var _me = master.create();

    _me.register('A1', 'a1.js');
    _me.shutdown();
    PROCESS.emit('SIGUSR1');
  });

});
