/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var mm = require('mm');
var fs = require('fs');
var should = require('should');
var common = require(__dirname + '/mock.js');
var child = require('../lib/child.js');
var master = require('../lib/master.js');

var PROCESS;

describe('master', function () {

  beforeEach(function (done) {
    common.resetAllStatic();
    PROCESS = common.mockProcess();
    PROCESS.makesureCleanAllMessage();
    PROCESS.__getOutMessage().should.eql([]);
    PROCESS.__getEvents().should.eql([]);

    master.mock(PROCESS);
    mm(child, 'create', common.mockChild);

    var cmd = require('util').format('rm -rf "%s/tmp"', __dirname);
    require('child_process').exec(cmd, function (e) {
      should.ok(!e);
      done();
    });
  });

  afterEach(function () {
    mm.restore();
  });

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
          e.message.should.containEql('ENOENT');
          done();
        });
      });
    });
  });
  /* }}} */

  /* {{{ should_public_api_works_fine() */
  it('should_public_api_works_fine', function (done) {
    var _me = master.create({'terminate_timeout' : 10});

    var _messages = [];
    ['fork', 'quit', 'giveup', 'signal'].forEach(function (i) {
      _me.on(i, function () {
        _messages.push([i, arguments]);
      });
    });

    var _p1 = _me.register('A1', 'a1.js');
    var _p2 = _me.register('A1', 'a2.js', {'trace_gc' : true});

    _p1.__getMessages().pop().should.eql(['stop', ['SIGKILL']]);

    /**
     * @ 实际上需要remove掉这个listener
     */
    _p1.emit('fork', 1);
    _p2.emit('fork', 1);
    _p2.emit('exit', 1, 23, 'SIGTERM');
    _p2.emit('giveup', 10, 600);

    _p2.emit('broadcast', 'A1', 'hello', 3);
    _p2.__getMessages().pop().should.eql(['broadcast', {'0' : 'hello', '1' : 'a1', '2' : 3, '3' : undefined}]);

    _me.dispatch();
    _p2.__getMessages().pop().should.eql(['start', {}]);
    _me.shutdown();
    _p2.__getMessages().pop().should.eql(['stop', {'0' : 'SIGTERM'}]);

    PROCESS.emit('SIGHUB');
    PROCESS.emit('SIGUSR1');
    _p2.__getMessages().pop().should.eql(['reload', {}]);

    PROCESS.emit('SIGTERM');
    _p2.__getMessages().pop().should.eql(['stop', {'0' : 'SIGTERM'}]);

    PROCESS.emit('SIGINT');
    _p2.__getMessages().pop().should.eql(['stop', {'0' : 'SIGTERM'}]);

    setTimeout(function () {
      _messages.should.eql([
        ['fork', {'0':'a1','1':1}],
        ['quit', {'0':'a1','1':1,'2':23,'3':'SIGTERM'}],
        ['giveup', {'0':'a1','1':10,'2':600}],
        ['signal', {'0':1, '1':'SIGHUB'}],
        ['signal', {'0':30,'1':'SIGUSR1'}],
        ['signal', {'0':15,'1':'SIGTERM'}],
        ['signal', {'0':2, '1':'SIGINT'}],
        ]);
      done();
    }, 20);
  });
  /* }}} */

  /* {{{ should_statusfile_works_fine() */
  it('should_statusfile_works_fine', function (done) {
    var _fn = __dirname + '/tmp/status.log';
    var _me = master.create({
      'statusfile' : _fn, 'statusflush_interval' : 20
    });
    _me.register('group1', './group1.js');
    _me.register('group2', './group1.js');
    setTimeout(function () {
      fs.readFile(_fn, 'utf8', function (e,d) {
        should.ok(!e);
        var d = d.split('\n');
        d.length.should.above(2);
        d.should.containEql(process.pid + ':\tgroup1\tpid\t{"k1":"aaa"}');
        d.should.containEql(process.pid + ':\tgroup2\tpid\t{"k1":"aaa"}');
        done();
      });
    }, 70);
  });
  /* }}} */

});
