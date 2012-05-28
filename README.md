[![Build Status](https://secure.travis-ci.org/aleafs/node-cluster.png)](http://travis-ci.org/aleafs/node-cluster)

This logo is on the other side of the GFW!

# 特性

`node-cluster` 是一个简单易用的 NodeJS 类库，帮助开发人员快速地搭建基于NodeJS的服务程序：

* 基于 master + worker 模式，能够有效利用多核处理器;
* 支持多端口监听，master 传递请求端的 socket fd 给各个 worker，性能损失极低;
* 同一端口下的多个 worker 之间提供简单的负载均衡支持;
* 支持对 worker 进程数的监控，支持单个 worker 根据已处理的请求数自动消亡;
* 支持 master 和 worker 的平滑重启 (SIGTERM)，不丢失请求;
* 支持通过向 master 发送 SIGUSR1 信号实现所有worker的自动重载.

# 安装

```bash
$ npm install node-cluster
```

# 使用

node-cluster的调用十分简单，核心调用代码不超过10行。请看下面的调用方法。  
dispatch.js:

```javascript
var cluster = require('node-cluster');

var master = new cluster.Master();
master.register(8080, 'app.js');
master.on('restartgiveup', function(port, msg) {
  // alert:
}).dispatch();
```

app.js：

```javascript
var cluster = require('node-cluster');
var server  = require('http').createServer(function (req, res) {
  // TODO
});

var worker = new cluster.Worker();
worker.ready(function (socket) {
  server.emit('connection', socket);
});
```

执行：`node dispatch.js`即可。

# 示例

demo目录下提供了一个典型的示例，你可以通过下列命令启动这个服务：

```bash
$ node demo/main.js &
```

其中:

* main.js 是master进程，通过 register 方法注册 worker进程，并通过 dispatch 进行工作; 除此之外，master 进程不需要做任何工作，你就可以实现一个高稳定性的生产服务;
* worker/http.js 提供了监听在 33749 端口上的 HTTP 服务; 通过NodeJS 原生的http模块实现，demo中仅提供了 hello world的示例;
* worker/echo.js 提供监听在 8080 端口上的Socket应答服务.
* worker/multi_port_http.js 提供了监听在 33750 和 33751 端口上的 HTTP 服务; 通过NodeJS 原生的http模块实现，demo中仅提供了 hello world的示例;

## 结合 [connect](https://github.com/senchalabs/connect) 使用

* [dispatch.js](/fengmk2/node-cluster/blob/master/demo/connect/dispatch.js)

```javascript
var cluster = require('node-cluster');

var master = cluster.Master();
master.register(19841, __dirname + '/app.js').dispatch();
```

* [app.js](/fengmk2/node-cluster/blob/master/demo/connect/app.js)

```javascript
var cluster = require('node-cluster');
var connect = require('connect');

var app = connect(connect.static(__dirname));

app.use(function(req, res) {
  res.end(req.url + ', pid ' + process.pid);
});

var admin = cluster.Worker();
admin.ready(function(socket) {
  app.emit('connection', socket);
});
```

* start 

```bash
$ node demo/connect/dispatch.js
```

## 结合 [webjs](https://github.com/iwillwen/webjs) 开发

webjs原生支持node-cluster哦，亲~
                                ————小问  
修改步骤十分简单，在webjs生成的代码中：

- server.js

```javascript
var cluster = require('node-cluster');

var master = new cluster.Master();
master.register(80, __dirname + 'controllers/index.js').dispatch();
```

- /controllers/index.js

  增加以下代码

```javascript
var cluster = require('node-cluster');

web.run(65536);  //把原本的80改成其他端口，以免冲突

var worker = cluster.Worker();
worker.ready(function(socket) {
    web.server.emit('connection', socket);
});
```

## 结合[express](https://github.com/visionmedia/express)

感谢[@yuest](https://github.com/yuest) 提供[Express使用说明](https://github.com/aleafs/node-cluster/issues/6#issuecomment-4516724).

```javascript
var app = require('express').createServer()
app.get('/error', function(req, res, next) {
 next(new Error('error'));
});
app.error(function(err, req, res) {
 res.statusCode = 500;
 res.end(err.message);
});

//app.listen(8080); //没问题

//使用 node-cluster 有问题
//因为 app 没有触发 listening
//可以在此加一句
//app.emit('listening');

var worker = require('node-cluster').Worker();
worker.ready(function(socket) {
 app.emit('connection', socket);
});
```

不过推荐不使用 `app.error`，而用 `app.use(function(err, req, res, next) {})` 四个参数的 `middleware`
express 3.0 会去掉 `app.error`

# 原理

请参考我的同事windyrobin的这篇文章：
[NodeJs 多核多进程并行框架实作](http://club.cnodejs.org/topic/4f16442ccae1f4aa27001081) 

本文的 `node-cluster` 在核心功能的实现原理上没有任何新意，只是对代码的组织做了更友好的封装，同时加入了一些基于稳定性考虑的特性.

# 注意

* worker 进程中的 `remain` 变量，是判断一个 worker 是否空闲的依据; 因此我强烈建议在你的应用程序 worker 进程中，采用更优雅的幂等操作对其计数，并且通过 `worker.release(remain)` 的方法回写;

# Authors

Below is the output from `git-summary`.

```
 project: node-cluster
 commits: 98
 files  : 18
 authors: 
    73  aleafs                  74.5%
    11  fengmk2                 11.2%
     6  Jackson Tian            6.1%
     6  aleafs zhang            6.1%
     1  Will Wen Gunn           1.0%
     1  pengchun                1.0%

```

## License 

(The MIT License)

Copyright (c) 2011-2012 aleafs and other node-cluster contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
