/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var should = require('should');

var _PROCESS = null;

beforeEach(function () {
  process = _PROCESS;
});

afterEach(function () {
  process = _PROCESS;
});

describe('worker process', function () {

  var worker = require(__dirname + '/../lib/worker.js');
  it('should_worker_hearbeat_works_fine', function () {

    var _me = worker.create({
      'heartbeat_interval'  : 10,
      'terminate_timeout'   : 200,
    });
    process.emit('SIGTERM');
  });

});
