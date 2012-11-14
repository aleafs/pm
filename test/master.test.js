/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var should = require('should');
var PROCESS = require(__dirname + '/mock.js').mockProcess();
var master = require(__dirname + '/../lib/master.js').create({}, PROCESS);

beforeEach(function () {
  PROCESS.makesureCleanAllMessage();
  PROCESS.__getOutMessage().should.eql([]);
  PROCESS.__getEvents().should.eql([]);
});

describe('master', function () {

  it('', function () {
  });

});
