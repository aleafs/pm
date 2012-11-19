/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var util = require('util');
var path = require('path');
var Emitter = require('events').EventEmitter;

var _PIDCOUNTER = 1;
var globalMessage = [];

exports.resetAllStatic = function () {
  _PIDCOUNTER = 1;
  globalMessage = [];
};

exports.mockProcess = function () {

  /**
   * @ 发出的消息
   */
  var msgsout = [];

  /**
   * @ 被触发的消息
   */
  var _events = [];

  var Process = function () {
    Emitter.call(this);
    this.env  = {'test-env' : 'lalal'};
    this.pid  = 0;
  };
  util.inherits(Process, Emitter);

  Process.prototype.cwd = function () {
    return path.normalize(__dirname);
  };

  Process.prototype.makesureCleanAllMessage = function () {
    msgsout = [];
    _events = [];
  };

  Process.prototype.send = function (msg, handle) {
    msgsout.push([msg, handle]);
  };

  Process.prototype.memoryUsage = function () {
    return {'rss' : 2, 'heapTotal' : 1, 'heapUsed' : 1};
  };

  Process.prototype.__getOutMessage = function () {
    return msgsout;
  };

  Process.prototype.__getEvents = function () {
    return _events;
  };

  Process.prototype.exit = function (code) {
    _events.push(['exit', code || 0]);
    this.emit('exit', code);
  };

  Process.prototype.kill = function (pid, signal) {
    _events.push(['kill', pid, signal]);
  };

  return new Process();
};

exports.mockFork = function () {

  var _arguments = arguments;

  var Sub = function () {
    Emitter.call(this);
    this.pid = _PIDCOUNTER++;
  };
  util.inherits(Sub, Emitter);

  Sub.prototype.__getArguments = function () {
    return _arguments;
  };

  /**
   * @ 发出的消息
   */
  var msgsout = [];

  Sub.prototype.send = function (msg, handle) {
    msgsout.push([msg, handle]);
    globalMessage.push(JSON.stringify([this.pid, msg, handle]));
  };

  Sub.prototype.kill = function (signal) {
    var _self = this;
    setTimeout(function () {
      _self.emit('exit', 0, signal);
    }, 1);
  };

  Sub.prototype.__getOutMessage = function () {
    return msgsout;
  };

  Sub.prototype.__getGlobalMessage = function () {
    return globalMessage;
  };

  return new Sub();
};

exports.mockChild = function () {

  var Child = function () {
    Emitter.call(this);
    this.pstatus = {
      'pid' : {'k1' : 'aaa'}
    };
  };
  util.inherits(Child, Emitter);

  /**
   * @ 收到的消息
   */
  var _messages = [];

  ['start', 'stop', 'reload', 'broadcast'].forEach(function (i) {
    Child.prototype[i] = function () {
      _messages.push([i, arguments]);
    };
  });

  Child.prototype.__getMessages = function () {
    return _messages;
  };

  return new Child();
};

