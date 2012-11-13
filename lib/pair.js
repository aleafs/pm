/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var net = require('net');
var util = require('util');

var Emitter = require('events').EventEmitter;

var _extend = function (a, b) {
  var a = a || {};
  for (var i in b) {
    a[i] = b[i];
  }
  return a;
};

exports.create = function (argv, options, name) {

  /**
   * @ 配置信息
   */
  var _options = _extend({
    'children'  : 1,
    'max_fatal_restart'  : 5,
    'max_heartbeat_lost' : -1,
  }, options);

  /**
   * @ 监听handle
   */
  var handles = {};
  var getHandle = function () {
  };

  /**
   * @ 子进程列表
   */
  var workers = {};

  var _me = {};

  return _me;
};
