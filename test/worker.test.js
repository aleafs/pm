/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var net = require('net');
var should = require('should');
var Common = require(__dirname + '/common.js');
var worker = require(__dirname + '/../lib/worker.js');

var _Handle = function (fn) {
  return net._createServerHandle(fn, -1, -1);
};

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

    _me.ready(function (socket, which) {
      socket.close();
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

    var sockfn = __dirname + '/a.socket';

    var server = net.createServer(function (socket) {
      socket.pipe(socket);
    });

    PROCESS.emit('message', {'type' : 'listen'});
    PROCESS.emit('message', {'type' : 'listen', 'data' : 'a'}, _Handle(sockfn));
    PROCESS.emit('message', {'type' : 'listen', 'data' : 'a'}, _Handle(sockfn));

    _me.once('listen', function (which) {
      /*
      var clt = net.connect({'path' : sockfn}, function (e) {
        console.log(e);
      });
      */

      PROCESS.emit('message', {'type' : 'suicide'});
      PROCESS.emit('SIGTERM');
      setTimeout(done, 25);
    });

    /*
    _me.ready(function (socket, which) {
      server.emit('connection', socket);
    });
    */

  });
  /* }}} */

});
