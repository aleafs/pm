/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var rewire = require('rewire');
var should = require('should');
var Common = require(__dirname + '/common.js');

var worker = rewire(__dirname + '/../lib/worker.js');

var _PROCESS = worker.__get__('process');
var _CONSOLE = worker.__get__('console');

beforeEach(function () {
  worker.__set__({
    'process' : Common.mockProcess(),
    'console' : Common.mockConsole(),
  });
});

afterEach(function () {
  worker.__set__({
    'process' : _PROCESS,
    'console' : _CONSOLE,
  });
});

describe('worker process', function () {

  /* {{{ should_worker_hearbeat_works_fine() */
  it('should_worker_hearbeat_works_fine', function () {

    var _me = worker.create({
      'heartbeat_interval' : 10,
      'terminate_timeout'  : 200,
    });

    var log = worker.__get__('console');
    _me.setLogger(function () {
      log.log(arguments);
    });

    _me.broadcast('who', 'test msg');

    log.__getMessages().pop().should.eql(['log', {
      '0' : '_SEND',
      '1' : '{"type":"broadcast","data":{"who":"who","msg":"test msg"}}'
    }]);

    _me.listen(__dirname + '/a.socket', function (socket) {
      socket.on('data', function (data) {
        data.toString().should.eql('test');
      });
    });

    var pro = worker.__get__('process');
    pro.emit('SIGTERM');
    pro.__getEvents().pop().should.eql({'0':'SIGTERM'});
  });
  /* }}} */

});
