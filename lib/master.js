/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var STATUS  = require(__dirname + '/common.js').STATUS;
var MESSAGE = require(__dirname + '/common.js').MESSAGE;
var Debug   = require(__dirname + '/common.js').debug;
var Listen  = require(__dirname + '/common.js').listen;

var CPUSNUM = require('os').cpus().length;
var _NOTICE = function(name, message) {
  Debug('master', name + ' ' + message);
};

/* {{{ private function _normalize() */
var _normalize  = function(name) {
  return name.toString().trim().toLowerCase();
};
/* }}} */

var _createPair = function(file, options) {

  /* {{{ _options  */

  var _options  = {
    'script'      : file,             /**<    启动的脚本文件名        */
    'listen'      : [],               /**<    监听的端口(socket path) */
    'children'    : CPUSNUM,          /**<    子进程个数              */
    'max_request' : 0,                /**<    执行多少个请求后消亡    */
  };

  for (var i in options) {
    _options[i] = options[i];
  }

  /* }}} */

  /**
   * @connection queue
   */
  var _fdqueue  = [];

  /**
   * @process status
   */
  var _pstatus  = {};

  /**
   * @to be killed process
   */
  var _tobekill = [];

  /**
   * @worker status
   */
  var _wstatus  = STATUS.PENDING;

  /* {{{ private function _fork() */
  /**
   * fork a new child process
   * @return {Object} child_process
   */
  var _fork = function() {
    var sub = require('child_process').fork(_options.script);
    var pid = sub.pid;

    _pstatus[pid]   = {
      'status'  : STATUS.PENDING,
    };

    var rpc = function(type, data, handle) {
      try {
        sub.send({
          'type'  : type,
          'data'  : data,
        }, handle);
      } catch(e) {
        _NOTICE('SEND', e.toString());
      }
    };

    /**
     * @on message
     */
    /* {{{ */
    sub.on('message', function(msg) {
      if (!msg.type) {
        return;
      }

      switch (msg.type) {
        case MESSAGE.GET_FD:
          var _fd   = _fdqueue.shift();
          rpc(MESSAGE.REQ_FD, null, _fd);
          if (_fd) {
            _fd.close();
          }
          break;

        case MESSAGE.STATUS:
          _pstatus[pid] = msg.data;
          // xxx: 判断ready状态
          break;

        case MESSAGE.RELOAD:
          break;

        case MESSAGE.SENDTO:
          break;

        default:
          break;
      }
    });
    /* }}} */

    /**
     * @on exit
     */
    /* {{{ */
    sub.on('exit', function(code, signal) {
    });
    /* }}} */

    return sub;
  };
  /* }}} */

  var _me   = {};

  /* {{{ public function start() */
  _me.start = function() {
  };
  /* }}} */

  /* {{{ public function stop() */
  /**
   * stop worker processes
   */
  _me.stop  = function(signal) {
    _wstatus    = STATUS.STOPING;
    for (var pid in _pstatus) {
      try {
        process.kill('pid', signal || 'SIGTERM');
      } catch(e) {
      }
    }
  };
  /* }}} */

  /* {{{ public function reload() */
  _me.reload    = function() {
    for (var pid in _pstatus) {
      _tobekill.push(pid);
    }
  };
  /* }}} */

  return _me;

};

exports.create  = function(options) {

  /**
   * @master参数
   */
  /* {{{ */
  var _options  = {
    'pidfile'   : null,
  };
  for (var i in options) {
    _options[i] = options[i];
  }
  if (_options.pidfile) {
    var fs    = require('fs');
    fs.writeFile(_options.pidfile, process.pid, function(error) {
      if (error) {
        throw error;
      }
      process.on('exit', function() {
        fs.unlink(_options.pidfile, function(error) {
          console.log(error);
        });
      });
    });
  }
  /* }}} */

  /**
   * @worker列表
   */
  var _workers  = {};

  var _me   = {};

  _me.register  = function(name, file, options) {
    var sub = _createPair(file, options);
    _workers[_normalize(name)]  = sub;
    return sub;
  };

  _me.shutdown  = function(idx, signal) {
    var __list  = idx ? {idx : _workers[_normalize(idx)]} : _workers;
    for (var i in __list) {
      __list[i].stop(signal);
    }
  };

  _me.reload    = function(idx) {
    var __list  = idx ? {idx : _workers[_normalize(idx)]} : _workers;
    for (var i in __list) {
      __list[i].reload();
    }
  };

  process.on('SIGHUB',  function() {});
  process.on('exit',    function() {
    _me.shutdown(null, 'SIGKILL');
  });

  process.on('SIGTERM', function() {
    _NOTICE('SIGNALS', 'Got SIGTERM, about to exit...');
    _me.shutdown();
  });

  process.on('SIGUSR1', function() {
    _NOTICE('SIGNALS', 'Got SIGUSR1, about to reload...');
    _me.reload();
  });

  return _me;

};

