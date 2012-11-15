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

  it('should_public_api_works_fine', function () {
    var _me = master.create();

    _me.register('A1', 'a1.js');
    _me.register('A1', 'a2.js');

    _me.dispatch();
    _me.shutdown();
    PROCESS.emit('SIGUSR1');
  });

});
