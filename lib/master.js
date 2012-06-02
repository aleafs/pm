/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var STATUS  = require(__dirname + '/common.js').STATUS;
var MESSAGE = require(__dirname + '/common.js').MESSAGE;
var Debug   = require(__dirname + '/common.js').debug;
var Listen  = require(__dirname + '/common.js').listen;

var NOTICE  = function(name, message) {
  Debug('master', Array.prototype.join.call(arguments, ' '));
};

/* {{{ private function _normalize() */
var _normalize  = function(name) {
  return name.toString().trim().toLowerCase();
};
/* }}} */

var _createPair = function(file, options, master) {

  /* {{{ _options  */

  var _options  = {
    'script'      : file,
    'listen'      : [],
    'children'    : require('os').cpus().length,
    'max_request' : 0,
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
   * @process object
   */
  var _wakeups  = 0;
  var _pobject  = [];
  var killall = function(signal) {
    _pobject.forEach(function(sub) {
      try {
        process.kill(sub.pid, signal || 'SIGTERM');
      } catch(e) {
      }
    });
    _pobject    = [];
  };

  /**
   * @to be killed process
   */
  var _tobekill = [];

  /**
   * @listeners
   */
  var _listener = {};

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

    _pobject.push(sub);
    _pstatus[pid]   = {
      'status'  : STATUS.UNKNOWN,
    };

    var rpc = function(type, data, handle) {
      try {
        sub.send({
          'type'  : type,
          'data'  : data,
        }, handle);
      } catch(e) {
        NOTICE('SEND', e.toString());
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
          master.reload(msg.data);
          break;

        case MESSAGE.SENDTO:
          if (msg.data.name) {
            master.sendto(msg.data.name, msg.data.data);
          }
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
    for (var i = _pobject.length; i < _options.children; i++) {
      _fork();
    }

    _options.listen.forEach(function(item) {
      if (_listener[item]) {
        return;
      }
      _listener[item] = Listen(item, function(handle) {
        if (1 === _fdqueue.push(handle)) {
          _wakeups = (_wakeups + 1) % _pobject.length;
          try {
            _pobject[_wakeups].send({
              'type'  : MESSAGE.WAKEUP,
            });
          } catch (e) {
          }
        }
      });
    });
  };
  _me.start();
  /* }}} */

  /* {{{ public function stop() */
  /**
   * stop worker processes
   */
  _me.stop  = function(signal) {
    for (var idx in _listener) {
      _listener[idx].close();
      delete _listener[idx];
    }

    _listener   = {};
    _wstatus    = STATUS.STOPING;

    var _timer1 = setTimeout(function() {
      killall(signal);
      clearInterval(_timer2);
    }, 1000);

    var _timer2 = setInterval(function() {
      if (0 === _fdqueue.length) {
        killall(signal);
        clearTimeout(_timer1);
        clearInterval(_timer2);
      }
    }, 20);
  };
  /* }}} */

  /* {{{ public function accept() */
  _me.accept = function(data) {
    _pobject.forEach(function(sub) {
      try {
        sub.send({
          'type' : MESSAGE.COMMAND,
          'data' : data,
        });
      } catch(e) {
        NOTICE('SEND', e.toString());
      }
    });
  };
  /* }}} */

  /* {{{ public function reload() */
  _me.reload = function() {
    for (var pid in _pstatus) {
      _fork();
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
    var sub = _createPair(file, options, _me);
    _workers[_normalize(name)]  = sub;
    return sub;
  };

  _me.shutdown  = function(idx, signal) {
    for (var i in _workers) {
      if (!idx || i === idx) {
        _workers[i].stop(signal);
      }
    }
  };

  _me.reload    = function(idx) {
    for (var i in _workers) {
      if (!idx || i === idx) {
        _workers[i].reload();
      }
    }
  };

  _me.sendto    = function(idx, data) {
    idx = _normalize(idx);
    if (_workers[idx]) {
      _workers[idx].accept(data);
    }
  };

  process.on('SIGHUB',  function() {});
  process.on('exit',    function() {
    _me.shutdown(null, 'SIGKILL');
  });

  process.on('SIGTERM', function() {
    NOTICE('Got SIGTERM, about to exit...');
    _me.shutdown();
  });

  process.on('SIGUSR1', function() {
    NOTICE('Got SIGUSR1, about to reload...');
    _me.reload();
  });

  return _me;

};

