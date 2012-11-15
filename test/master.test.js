/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var fs = require('fs');
var rewire = require('rewire');
var should = require('should');
var common = require(__dirname + '/mock.js');
var master = rewire(__dirname + '/../lib/master.js');

var PROCESS;
beforeEach(function (done) {
  common.resetAllStatic();
  PROCESS = common.mockProcess();
  PROCESS.makesureCleanAllMessage();
  PROCESS.__getOutMessage().should.eql([]);
  PROCESS.__getEvents().should.eql([]);

  master.__set__({
    'PROCESS' : PROCESS,
    'CreateChild' : common.mockChild,
  });

  var cmd = require('util').format('rm -rf "%s/tmp"', __dirname);
  require('child_process').exec(cmd, function (e) {
    should.ok(!e);
    done();
  });
});

describe('master', function () {

  var pidfile = __dirname + '/tmp/a.pid';

  /* {{{ should_write_pidfile_works_fine() */
  it('should_write_pidfile_works_fine', function (done) {
    var _me = master.create({
      'pidfile' : pidfile
    });
    fs.readFile(pidfile, 'utf8', function (e, d) {
      should.ok(!e);
      d.should.eql('' + PROCESS.pid);

      fs.writeFileSync(pidfile, '-1');
      PROCESS.emit('exit');
      fs.readFile(pidfile, 'utf8', function (e, d) {
        should.ok(!e);
        fs.writeFileSync(pidfile, PROCESS.pid);
        PROCESS.emit('exit');
        fs.readFile(pidfile, 'utf8', function (e, d) {
          e.message.should.include('ENOENT, open');
          done();
        });
      });
    });
  });
  /* }}} */

  it('should_public_api_works_fine', function (done) {
    var _me = master.create({'terminate_timeout' : 10});

    var _messages = [];
    ['fork', 'quit', 'giveup'].forEach(function (i) {
      _me.on(i, function () {
        _messages.push([i, arguments]);
      });
    });

    var _p1 = _me.register('A1', 'a1.js');
    var _p2 = _me.register('A1', 'a2.js', {'trace_gc' : true});

    _p1.__getMessages().pop().should.eql(['stop', {'0' : 'SIGKILL'}]);

    /**
     * @ 实际上需要remove掉这个listener
     */
    //_p1.emit('fork', 1);
    _p2.emit('fork', 1);
    _p2.emit('exit', 1, 23, 'SIGTERM');
    _p2.emit('giveup', 10, 600);

    _p2.emit('broadcast', 'A1', 'hello', 3);
    _p2.__getMessages().pop().should.eql(['broadcast', {'0' : 'hello', '1' : 'a1', '2' : 3}]);

    _me.dispatch();
    _p2.__getMessages().pop().should.eql(['start', {}]);
    _me.shutdown();
    _p2.__getMessages().pop().should.eql(['stop', {'0' : 'SIGTERM'}]);

    PROCESS.emit('SIGUSR1');
    _p2.__getMessages().pop().should.eql(['reload', {}]);

    PROCESS.emit('SIGTERM');
    _p2.__getMessages().pop().should.eql(['stop', {'0' : 'SIGTERM'}]);

    setTimeout(function () {
      _messages.should.eql([
        ['fork', {'0':'a1','1':1}],
        ['quit', {'0':'a1','1':1,'2':23,'3':'SIGTERM'}],
        ['giveup', {'0':'a1','1':10,'2':600}]
        ]);
      done();
    }, 20);
  });

});
