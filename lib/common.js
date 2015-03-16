/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var net = require('net');
var TCP  = process.binding('tcp_wrap').TCP;
var Pipe = process.binding('pipe_wrap').Pipe;

exports.getHandle = function (idx, addr) {
  var h = null;
  var r = 0;

    if (!addr) {
        addr = '0.0.0.0';
    }

  idx = Number(idx) || idx;
  if ('number' === (typeof idx)) {
    h = new TCP();
    r = h.bind(addr, idx);
  } else {
    h = new Pipe();
    r = h.bind(idx);
  }

  if (0 !== r) {
    h.close();
    h = null;
  }

  return h;
};

exports.listen2 = function (handle, connect, backlog) {
  handle.onconnection = function () {
    var c = null;
    for (var i in arguments) {
      if (arguments[i].fd) {
        c = arguments[i];
        break;
      }
    }
    var s = new net.Socket({'handle' : c});
    s.readable  = true;
    s.writable  = true;
    s.resume();
    s.emit('connect');
    connect(s);
  };
  handle.listen(backlog || 1023);
  return handle;
};

