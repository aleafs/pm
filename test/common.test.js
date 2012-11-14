/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var http = require('http');
var net = require('net');
var should = require('should');

var common = require(__dirname + '/../lib/common.js');

describe('common functions', function () {

  [33046].forEach(function (idx) {
    it('should_listen_at_' + idx + '_works_fine', function (done) {
      var _me = http.createServer(function (req, res) {
        res.end(req.url);
      }).listen(common.getHandle(idx));

      return done();
      http.get('http:/' + '/localhost:33046/' + idx, function (res) {
        console.log(res);
        _me.close(done);
      });
    });
  });

});

