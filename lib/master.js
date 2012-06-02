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
   * @配置参数
   */
  /* {{{ */
  var _options  = {
    'pidfile'               : null,         /**<    进程PID文件             */
    'max_fatal_restart'     : 5,            /**<    异常退出最大重启次数    */
    'restart_time_window'   : 60,           /**<    异常重启统计时间窗口(s) */
  };
  for (var i in options) {
    _options[i] = options[i];
  }
  /* }}} */

  /**
   * @master状态
   */
  var _mstatus  = STATUS.PENDING;

  /**
   * @worker配置表
   */
  var _configs  = {};

  var _me   = {};

  /* {{{ public function register() */
  /**
   * 注册worker
   *
   * @access public
   * @param {String} name
   * @param {String} file
   * @param {Object} options
   */
  _me.register  = function(name, file, options) {
    var sub = _createPair(file, options);
    _configs[_normalize(name)]  = sub;
    return sub;
  };
  /* }}} */

  /* {{{ public function shutdown() */
  /**
   * @停止某个worker
   *
   * @param {String} idx
   */
  _me.shutdown  = function(idx) {
    idx = _normalize(idx);
    if (_configs[idx]) {
      _configs[idx].stop();
    }
  };
  /* }}} */

  /* {{{ public function reload() */
  /**
   * 重新加载某个worker
   *
   * @access public
   * @param {String} idx
   */
  _me.reload    = function(idx) {
    idx = _normalize(idx);
    if (_configs[idx]) {
      _configs[idx].reload();
    }
  };
  /* }}} */

  /* {{{ public function dispatch() */
  /**
   * master运行
   *
   * @access public
   */
  _me.dispatch  = function() {

    /**
     * @PID file
     */
    /* {{{ */
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

    return;

    /**
     * @启动服务
     */
    /* {{{ */
    for (var name in _configs) {
      var _this = _configs[name];
      for (var i = 0; i < _this.children; i++) {
        var sub = _newchild(name);
        _pstatus[sub.pid]   = {
          'name'    : name,
          'child'   : sub,
        };
      }
      _this.listen.forEach(function(item) {
        Listen(item, function(handle) {
          _wcqueue[name].push(handle);
        });
      });
    }
    /* }}} */

  };
  /* }}} */

  /**
   * @SIGHUB
   */
  /* {{{ */
  process.on('SIGHUB',  function() {});
  process.on('exit',    function() {
    for (var name in _configs) {
      _configs[name].stop('SIGKILL');
    }
  });
  /* }}} */

  /**
   * @SIGTERM
   */
  /* {{{ */
  process.on('SIGTERM', function() {
    _mstatus  = STATUS.STOPING;
    _NOTICE('SIGNALS', 'Got SIGTERM, about to exit...');
    for (var name in _configs) {
      _configs[name].stop();
    }
  });
  /* }}} */

  /**
   * @SIGUSR1
   */
  /* {{{ */
  process.on('SIGUSR1', function() {
    _NOTICE('SIGNALS', 'Got SIGUSR1, about to reload...');
    for (var name in _configs) {
      _configs[name].reload();
    }
  });
  /* }}} */

  return _me;

};

