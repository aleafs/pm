/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var fs = require('fs');
var net = require('net');
var http = require('http');
var should = require('should');
var Common = require(__dirname + '/mock.js');
var worker = require('../lib/worker.js');
var _Handle = require('../lib/common.js').getHandle;

var cleanSocketFiles  = function (path, callback) {
  fs.readdir(path, function (err, res) {
    (res || []).forEach(function (fn) {
      if (String(fn).match(/\.socket$/)) {
        fs.unlinkSync(path + '/' + fn);
      }
    });
    callback(err);
  });
};

var PROCESS;
beforeEach(function (done) {

  Common.resetAllStatic();
  PROCESS = Common.mockProcess();
  PROCESS.makesureCleanAllMessage();
  PROCESS.__getOutMessage().should.eql([]);
  PROCESS.__getEvents().should.eql([]);

  cleanSocketFiles(__dirname, done);
});

afterEach(function (done) {
  cleanSocketFiles(__dirname, done);
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
      'data' : {'who' : 'who', 'pid' : 0, 'msg' : 'test msg'}
    }, undefined]);

    _me.ready(function (client, which) {
      client.end();
    });

    PROCESS.__getOutMessage().pop().should.eql([{
      'type' : 'ready',
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
      msg.should.containEql(JSON.stringify(['Fuck GFW', 'FBX', -1]));
      msg.should.containEql(JSON.stringify(['suicide', 'SIGTERM']));
      msg.should.containEql(JSON.stringify(['suicide', 'message']));
      msg.should.containEql(JSON.stringify(['listen', 'a']));
      msg.should.containEql('exit');
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
    _me.ready(function (socket, which) {
      if ('a' === which) {
        _s1.emit('connection', socket);
      }
    });

    var options = {
      'host' : 'localhost', 'port' : 33046, 'path' : '/aabbce'
    };

    _me.once('listen', function (which) {
      which.should.eql('a');

      var n = 2;
      for (var i = 0; i < n; i++) {
        http.get(options, function (res) {
          res.headers.should.have.property('x-lalla', '/aabbce');
          PROCESS.emit('message', {'type' : 'listen', 'data' : 'a'}, _Handle('33046'));
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

  /* {{{ should_default_onconnect_works_fine() */
  it('should_default_onconnect_works_fine', function (done) {
    var _me = worker.create({
      'heartbeat_interval' : 1000,
      'terminate_timeout'  : 20,
    }, PROCESS);

    var _fn = __dirname + '/' + process.version + '.a.socket';
    PROCESS.emit('message', {'type' : 'listen', 'data' : 'a'}, _Handle(_fn));
    _me.ready();

    var clt = net.connect(_fn, function () {
    });
    clt.on('data', function (d) {
      (true).should.eql(false);
    });
    clt.on('end', function () {
      done();
    });
  });
  /* }}} */

  /* {{{ should_serialStart_works_fine() */
  it('should_serialStart_works_fine', function (_done) {

    var _me = worker.create({
      'heartbeat_interval' : 1000,
      'terminate_timeout'  : 20,
    }, PROCESS);

    var txt = '';
    var GET_TOKEN_TIMEOUT = 100;

    _me.serialStart(txt, GET_TOKEN_TIMEOUT);

    _me.serialStart(function (done) {      
      txt = 'child start!';
      done();
    }, GET_TOKEN_TIMEOUT);

    PROCESS.emit('message', {'token' : -1});

    setTimeout(function () {
      txt.should.eql('');

      PROCESS.emit('message', {'token' : 1});

      setTimeout(function () {
        txt.should.eql('child start!');

        PROCESS.emit('message', {'test' : ''});
        _done();
      }, 10);
    }, GET_TOKEN_TIMEOUT + 1);
  });
  /* }}} */

  describe('disconnect()', function () {
    it('should disconnect and close all listeners', function (done) {
      var w = worker.create({
        heartbeat_interval: 1000,
        terminate_timeout: 20,
      }, PROCESS);

      var web = http.createServer(function (req, res) {
        if (req.url === '/disconnect') {
          w.disconnect();
        }
        res.setHeader('x-url', req.url);
        res.end(req.url);
      });

      PROCESS.emit('message', {'type' : 'listen', 'data' : 'a'}, _Handle('43119'));

      /**
       * @ 默认处理，连接就断掉
       */
      w.ready(function (socket, which) {
        if ('a' === which) {
          web.emit('connection', socket);
        }
      });

      var options = {
        'host' : 'localhost', 'port' : 43119, 'path' : '/normal-request'
      };

      http.get(options, function (res) {
        res.headers.should.have.property('x-url', '/normal-request');
      });

      w.once('listen', function (which) {
        http.get(options, function (res) {
          res.headers.should.have.property('x-url', '/normal-request');
        });

        options.path = '/disconnect';
        http.get(options, function (res) {
          res.headers.should.have.property('x-url', '/disconnect');
          setTimeout(function () {
            var msgs = PROCESS.__getOutMessage();
            var disconnectMsg = msgs[1][0];
            disconnectMsg.type.should.equal('disconnect');
            disconnectMsg.data.suicide.should.equal(true);
            done();
          }, 10);
        });

      });
    });

  });

});
