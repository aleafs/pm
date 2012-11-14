/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var net = require('net');
var http = require('http');
var should = require('should');
var Common = require(__dirname + '/mock.js');
var worker = require(__dirname + '/../lib/worker.js');

var _Handle = require(__dirname + '/../lib/common.js').getHandle;

var PROCESS;
beforeEach(function () {
  PROCESS = Common.mockProcess();
  PROCESS.makesureCleanAllMessage();
  PROCESS.__getOutMessage().should.eql([]);
  PROCESS.__getEvents().should.eql([]);
});

describe('worker process', function () {

  /* {{{ should_hearbeat_works_fine() */
  it('should_hearbeat_works_fine', function (done) {

    var _me = worker.create({
      'heartbeat_interval' : 10,
        'terminate_timeout'  : 200,
    }, PROCESS);

    _me.broadcast('who', 'test msg');
    PROCESS.__getOutMessage().pop().should.eql([{
      'type' : 'broadcast',
      'data' : {'who' : 'who', 'msg' : 'test msg'}
    }, undefined]);

    _me.ready(function (client, which) {
      client.end();
    });

    PROCESS.__getOutMessage().pop().should.eql([{
      'type' : 'gethandle',
      'data' : undefined
    }, undefined]);

    setTimeout(function () {
      var msg = PROCESS.__getOutMessage();
      for (var i = 0; i < msg.length; i++) {
        var s = msg[i].shift();
        if ('heartbeat' === s.type) {
          JSON.stringify(s.data).should.eql(JSON.stringify({
            'hbterm' : 10,
            'scores' : {},
            'memory' : {'rss': 2, 'heapTotal': 1, 'heapUsed': 1}
          }));
          done();
          return;
        }
      }
      (true).should.eql(false);
    }, 15);
  });
  /* }}} */

  /* {{{ should_messages_works_fine() */
  it('should_messages_works_fine', function (_done) {

    var _me = worker.create({
      'heartbeat_interval' : 1000,
      'terminate_timeout'  : 20,
    }, PROCESS);

    var msg = [];
    _me.on('message', function (txt, from, pid) {
      msg.push(JSON.stringify([txt, from, pid]));
    });
    _me.on('suicide', function (from) {
      msg.push(JSON.stringify(['suicide', from]));
    });
    _me.on('exit', function () {
      msg.push('exit');
    });
    _me.on('listen', function (which) {
      msg.push(JSON.stringify(['listen', which]));
    });

    var done = function () {
      msg.should.include(JSON.stringify(['Fuck GFW', 'FBX', -1]));
      msg.should.include(JSON.stringify(['suicide', 'SIGTERM']));
      msg.should.include(JSON.stringify(['suicide', 'message']));
      msg.should.include(JSON.stringify(['listen', 'a']));
      msg.should.include('exit');
      _done();
    };

    PROCESS.emit('message');
    PROCESS.emit('message', {'data' : 'blabla'});
    PROCESS.emit('message', {'type' : 'undefined'});
    PROCESS.emit('message', {'type' : 'hello', 'data' : 'Fuck GFW', 'from' : 'FBX', '_pid' : -1});

    var _s1 = http.createServer(function (req, res) {
      res.writeHeader(200, {'x-lalla' : req.url});
      res.end(req.url);
    });

    PROCESS.emit('message', {'type' : 'listen'});
    PROCESS.emit('message', {'type' : 'listen', 'data' : 'a'}, _Handle('33046'));

    /**
     * @ 默认处理，连接就断掉
     */
    _me.ready(function (client, which) {
      if ('a' === which) {
        _s1.emit('connection', client);
      }
    });

    var options = {
        'host' : 'localhost', 'port' : 33046, 'path' : '/aabbce'
    };
    _me.on('listen', function (which) {
      which.should.eql('a');

      var n = 2;
      for (var i = 0; i < n; i++) {
        http.get(options, function (res) {
          res.headers.should.have.property('x-lalla', '/aabbce');
          if (0 === (--n)) {
            PROCESS.emit('message', {'type' : 'suicide'});
            PROCESS.emit('SIGTERM');
            setTimeout(done, 25);
          }
        });
      }
    });
  });
  /* }}} */

});
