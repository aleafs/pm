/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var net = require('net');
var should = require('should');

var common = require(__dirname + '/../lib/common.js');

describe('common functions', function () {

  it('should_listen_to_socket', function (done) {
    var _fn = __dirname + '/a.socket';

    var _fn = 33046;
    var _me = net.createServer(function (c) {
      console.log('a');
      c.end();
      done();
    }).listen(common.getHandle(_fn));

    var clt = net.connect({'port' : _fn}, function (e) {
      should.ok(!e);
    });
  });

});

