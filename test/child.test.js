/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var rewire = require('rewire');
var should = require('should');
var common = require(__dirname + '/mock.js');

var Child = rewire(__dirname + '/../lib/child.js');

var PROCESS;
beforeEach(function () {
  PROCESS = common.mockProcess();
  PROCESS.makesureCleanAllMessage();
  PROCESS.__getOutMessage().should.eql([]);
  PROCESS.__getEvents().should.eql([]);

  Child.__set__({
    'PROCESS' : PROCESS,
    'fork'  : common.mockFork,
  });
});

describe('child manager', function () {

  it('private _fork', function () {
    var _me = Child.create([])._fork();
    console.log(_me);
  });

});

