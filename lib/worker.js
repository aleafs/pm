/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var STATUS	= require('./define.js').CHILD.STATUS;
var MSGTYPE	= require('./define.js').MESSAGE.TYPE;

var Worker	= {
	shutdown	: false,
};

var myself	= {
	'remain'	: 0,		/**<	避免大量请求瞬间涌入 */
	'status'	: STATUS.PEDDING,
};

/* {{{ function Worker.ready() */
Worker.ready	= function (callback, reload) {

	myself.status	= STATUS.RUNNING;
	myself.remain	= 0;

	/**
	 * @发送心跳
	 */
	process.hasOwnProperty('send') && setInterval(function () {
		var msg	= myself;
		msg.memory	= process.memoryUsage();
		process.send({
			'type'	: MSGTYPE.HEART,
			'data'	: msg,
		});
	}, 1000);

	/**
	 * @master发来的fd处理
	 */
	process.on('message', function (msg, handle) {
		if (!msg.type) {
			return;
		}

		switch (msg.type) {
			case MSGTYPE.REQ_FD:
				myself.remain++;
				callback(handle);
				break;
			default:
				break;
		}
	});

	process.on('SIGUSR1',	function () {});
	process.on('SIGHUP',	function () {});
	process.on('SIGTERM',	function () {
		Worker.shutdown	= true;
	});
}
/* }}} */

/* {{{ function Worker.release() */
Worker.release	= function () {
	myself.remain--;
}
/* }}} */

exports.create	= function () {
	return Worker;
}

