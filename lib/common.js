/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var TCP  = process.binding('tcp_wrap').TCP;
var Pipe = process.binding('pipe_wrap').Pipe;

exports.getHandle = function (idx) {
  var h = null;
  var r = 0;

  idx = Number(idx) || idx;
  if ('number' === (typeof idx)) {
    h = new TCP();
    r = h.bind('0.0.0.0', idx);
  } else {
    h = new Pipe();
    r = h.bind(idx);
  }

  if (r) {
    h.close();
    h = null;
  }

  return h;
};
