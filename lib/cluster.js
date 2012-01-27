/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Child	= require('child_process');
var Net		= require('net');
var TCP		= process.binding('tcp_wrap').TCP;

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

/**
 * @单进程接受的最大请求次数
 */
var MAX_REQUEST	= 10000;

/* {{{ function intval() */
function intval (num, dft) {
	try {
		num	= parseInt(num, 10);
		dft	= parseInt(dft, 10);
	} catch (e) {}

	return num || dft || 0;
}
/* }}} */

/* {{{ function isport() */
function isport(num) {
	return num == intval(num, 0) && num > 0;
}
/* }}} */

/* {{{ function timestamp() */
function timestamp() {
	return intval((new Date()).getTime() / 1000, 0);
}
/* }}} */

var Master		= {

	/**
	 * @shutdown标记
	 */
	'shutdown'	: false,

	/**
	 * @注册的监听分发列表
	 */
	'bindings'	: {},

	/**
	 * @已经启动的子进程列表
	 */
	'children'	: {},

	/**
	 * @即将被kill的子进程
	 */
	'killings'	: [],

}

/**
 * @注册子进程映射表
 */
Master.register	= function (name, path, cnum) {
	Master.bindings[name]	= {
		'path'	: path,
		'cnum'	: intval(cnum, 1),
		'live'	: 0,
	};
};

/**
 * @请求分发
 */
Master.dispatch = function () {

	/**
	 * @启动子进程
	 */
	var startAll	= function () {
		for (var name in Master.bindings) {
			var cfg	= Master.bindings[name];
			for (var i = 0; i < cfg.cnum; i++) {
				Master.startup(cfg.path, name);
			}
			isport(name) && Master.listen(name);
		}
	};
	startAll();

	/**
	 * @忽略HUP信号
	 */
	process.on('SIGHUP',  function () {});
	
	/**
	 * @TERM信号，优雅退出
	 */
	process.on('SIGTERM', function () {
		console.log('[master] Got SIGTERM signal.');
		Master.shutdown	= true;
		for (var name in Master.children) {
			for (var pid in Master.children[name]) {
				process.kill(pid, 'SIGTERM');
			}
		}
	});

	/**
	 * @USR1信号，重启所有子进程
	 */
	process.on('SIGUSR1', function () {
		for (var name in Master.children) {
			for (var pid in Master.children[name]) {
				Master.killings.push(pid);
			}
		}
		startAll();
	});
};

/**
 * @启动子进程
 */
Master.startup = function (path, name) {
	var sub	= Child.fork(path);
	var pid	= sub.pid;

	if (!Master.children[name]) {
		Master.children[name]	= {};
	}

	Master.children[name][pid]	= {
		'uptime'	: timestamp(),
		'scores'	: 0,
		'remain'	: 5,		/**<	避免大量请求瞬间涌入 */
		'status'	: CSTATUS.PEDDING,
		'process'	: sub,
	};

	sub.on('message', function (msg) {
		Master.doMessage(msg, name, pid);
	});
	sub.on('exit', function (code, signal) {
		try {
			delete Master.children[name][pid];
		} catch (e) {}

		// TODO:
		// startup();
		if (Master.shutdown && !Master.children) {
			process.exit(0);
		}
	});
};

/**
 * @监听端口
 */
Master.listen = function (port) {
	var server	= new TCP();
	server.bind('0.0.0.0', port);
	server.listen('/dev/null');
	server.onconnection	= function (handle) {
		var pid	= Master.select(port);
		if (!pid) {
			// TODO: write log and output
			handle.close();
			return;
		}

		var sub	= Master.children[port][pid];
		if ((++sub.scores) >= MAX_REQUEST ) {
			Master.killings.push(pid);
			if (Master.bindings[port] && Master.bindings[port].path) {
				Master.startup(Master.bindings[port].path, port);
			}
		}

		sub.remain++;
		sub.process.send({
			'type'	: MESSAGE.REQ_FD,
		}, handle);

		handle.close();
	}
};

/**
 * @选择一个子进程
 */
Master.select	= function (port) {
	var pid	= 0;
	var max	= 4294967296;

	if (!Master.children[port]) {
		return;
	}

	for (var idx in Master.children[port]) {
		var sub	= Master.children[port][idx];
		if (max > sub.remain && CSTATUS.RUNNING == sub.status) {
			pid	= idx;
			max	= sub.remain;
		}
	}

	return pid;
};

/**
 * @子进程发送的消息
 */
Master.doMessage = function (msg, port, pid) {
	if (!msg.type || !msg.data) {
		return;
	}

	switch (msg.type) {
		case MESSAGE.HEART:
			var sub	= Master.children[port][pid];
			for (var key in msg.data) {
				sub[key]	= msg.data[key];
				if ('status' == key && CSTATUS.RUNNING == sub[key]) {
					var tmp	= Master.killings.pop();
					if (tmp) {
						try {
							Master.children[port][tmp].status = CSTATUS.STOPING;
							process.kill(tmp, 'SIGTERM');
						} catch (e) {}
					}
				}
			}
			break;

		case MESSAGE.RELOAD:
			break;

		default:
			break;
	}
};

var Worker	= function () {

	/**
	 * @未处理请求个数
	 */
	this.remain	= 0;

	/**
	 * @进程状态
	 */
	this.status	= CSTATUS.PEDDING;

};

Worker.prototype.ready	= function (callback) {

	this.remain	= 0;
	this.status	= CSTATUS.RUNNING;

	var worker	= this;

	/**
	 * @报告心跳
	 */
	process.hasOwnProperty('send') && setInterval(function () {
		try {
			process.send({
				'type'	: MESSAGE.HEART,
				'data'	: {
					'status'	: worker.status,
					'remain'	: worker.remain,
					'memory'	: process.memoryUsage(),
				},
			});
		} catch (e) {}
	}, 1000);

	/**
	 * @处理FD
	 */
	process.on('message', function (msg, handle) {
		if (!msg.type || MESSAGE.REQ_FD != msg.type || !handle) {
			return;
		}

		if (!callback) {
			handle.close();
			return;
		}

		worker.remain++;

		var socket	= new Net.Socket({
			'handle'	: handle,
		});

		socket.readable	= true;
		socket.writable	= true;
		socket.resume();
		socket.emit('connect');

		callback(socket);
	});

	/**
	 * @信号捕捉
	 */
	process.on('SIGUSR1',	function() {});
	process.on('SIGHUP',	function() {});
	process.on('SIGTERM',	function() {
		worker.status	= CSTATUS.STOPING;
		setInterval(function () {
			if (worker.remain < 1 && CSTATUS.STOPING == worker.status) {
				console.log('[worker] ' + process.pid + ' terminated after ' + process.uptime() + ' seconds.');
				process.exit(0);
			}
		}, 500);
	});
};

/**
 * @请求结束，释放remain资源
 */
Worker.prototype.release	= function () {
	this.remain--;
};

exports.Master	= Master;
exports.Worker	= Worker;
