/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var rewire = require('rewire');
var should = require('should');
var worker = rewire(__dirname + '/../lib/worker.js');

var _PROCESS = worker.__get__('process');

beforeEach(function () {
  worker.__set__('process', require(__dirname + '/common.js').mockProcess());
});

afterEach(function () {
  worker.__set__('process', _PROCESS);
});

describe('worker process', function () {

  it('should_worker_hearbeat_works_fine', function () {

    var _me = worker.create({
      'heartbeat_interval' : 10,
      'terminate_timeout'  : 200,
    });

    var msg = [];
    _me.setLogger(function (msg) {
      msg.push(msg);
    });

    var pro = worker.__get__('process');
    pro.emit('SIGTERM');
    pro.__getEvents().pop().should.eql({'0':'SIGTERM'});
  });

});
