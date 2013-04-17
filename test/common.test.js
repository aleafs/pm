/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var http = require('http');
var net = require('net');
var should = require('should');
var libdir = process.env.PM_COV ? '../lib-cov' : '../lib';
var common = require(libdir + '/common.js');

describe('common functions', function () {

  it('handle_close_after_bind_failed', function () {
    should.ok(!common.getHandle('/i/am/denied.socket'));
  });

  var sock = __dirname + '/' + process.version + '.a.socket';

  [33046, '33046', sock].forEach(function (idx) {
    it('listen at: ' + idx, function (done) {
      var _me = http.createServer(function (req, res) {
        res.end(req.url);
      });
      
      var s = common.listen2(common.getHandle(idx), function (socket) {
        _me.emit('connection', socket);
      });

      var options = {
        'path' : '/' + idx,
      };
      if ('number' === (typeof idx) || idx.match(/^\d+$/)) {
        options.host = 'localhost';
        options.port = Number(idx);
      } else {
        options.socketPath = idx;
      }
      http.get(options, function (res) {
        s.close();
        done();
      });
    });
  });

});

