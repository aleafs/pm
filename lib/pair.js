/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var fork = require('child_process').fork;
var net  = require('net');
var util = require('util');

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
    'listen'  : [],
    'children'  : 0,
    'max_fatal_restart'  : 5,
    'max_heartbeat_lost' : -1,
  }, options);

  if (!_options.children) {
    _options.children = require('os').cpus().length;
  }

  if (!_options.listen) {
    _options.listen = [];
  } else if (!Array.isArray(_options.listen)) {
    _options.listen = _options.listen.toString().split(',');
  }
  _options.listen.map(function (i) {
    return Number(i) || i;
  });
  console.log(_options.listen);

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

  /**
   * @ 进程状态表
   */
  var pstatus = {};

  var command = argv.join(' ');
  var exepath = argv.shift();

  /* {{{ private function _fork() */
  var _fork = function () {
    var sub = fork(exepath, argv, {
      'cwd' : process.cwd(),
      'env' : _extend({}, process.env)
    });

    var pid = sub.pid;
    workers[pid] = sub;
    pstatus[pid] = {
      'uptime'  : Date.now(),
    };

    sub.on('exit', function (code, signal) {
      delete workers[pid];
      delete pstatus[pid];
    });
  };
  /* }}} */

  var _me = {};

  return _me;
};

