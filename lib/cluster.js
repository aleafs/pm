/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Child	= require('child_process');

/**
 * @消息类型
 * @奇数表示 master -> worker
 */
var MESSAGE	= {
	RELOAD	: 2,			/**<	重新加载配置、缓存，api (msg) => master (signal) => worker */
	REQ_FD	: 11,
	HEART	: 20,
};

/**
 * @子进程状态
 */
var CSTATUS	= {
	PEDDING	: 0,			/**<	正在初始化	*/
	RUNNING	: 10,			/**<	正常工作	*/
	STOPING	: 20,			/**<	准备退出	*/
};

/* {{{ function intval() */
function intval (num, dft) {
	try {
		num	= parseInt(num);
		dft	= parseInt(dft);
	} catch (e) {}

	return num || dft || 0;
}
/* }}} */

/* {{{ function timestamp() */
function timestamp() {
	return intval((new Date()).getTime() / 1000, 0);
}
/* }}} */

var Master		= {

	/**
	 * @注册的监听分发列表
	 */
	'bindings'	: {},

	/**
	 * @已经启动的子进程列表
	 */
	'children'	: {},

	/**
	 * @注册子进程映射表
	 */
	'register'	: function (port, path, cnum) {
		Master.bindings[intval(port, 0)]	= {
			'path'	: path,
			'cnum'	: intval(cnum, 1),
		};
	},

	/**
	 * @请求分发
	 */
	'dispatch'	: function () {
		for (var port in Master.bindings) {
			var cfg	= Master.bindings[port];
			for (var i = 0; i < cfg.cnum; i++) {
				Master.wakeup(cfg.path, port);
			}
		}
		port > 0 && Master.listen(port);

		/**
		 * @TERM信号，优雅退出
		 */
		process.on('SIGTERM', function () {
			
		});

		/**
		 * @USR1信号，重启所有子进程
		 */
		process.on('SIGUSR1', function () {
			//
		});

		process.on('SIGHUP',  function () {});
	},

	/**
	 * @启动子进程
	 */
	'wakeup'	: function (path, port) {
		var sub	= Child.fork(path);
		var pid	= sub.pid;

		if (!Master.children[port]) {
			Master.children[port]	= {};
		}

		Master.children[port][pid]	= {
			'uptime'	: timestamp(),
			'scores'	: 0,
			'remain'	: 5,		/**<	避免大量请求瞬间涌入 */
			'status'	: CSTATUS.PEDDING,
			'process'	: sub,
		};

		sub.on('exit', function (code, signal) {
			try {
				delete Master.children[port][pid];
			} catch (e) {}
		});

		/**
		 * @子进程发送的消息
		 */
		sub.on('message', function (msg)) {
			if (!msg.type || !msg.data) {
				return;
			}

			switch (msg.type) {
				case MESSAGE.HEART:
					break;

				case MESSAGE.RELOAD:
					break;

				default:
					break;
			}
		};
	},

	/**
	 * @监听端口
	 */
	'listen'	: function (port) {
	},

};

var Worker	= {
};

exports.create	= function (isMaster) {
	if (isMaster) {
		return {
			bind	: Master.register,
			listen	: Master,
		};
	} else {
	}
};

