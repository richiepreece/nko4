/* jshint node:true */
'use strict';

// https://github.com/nko4/website/blob/master/module/README.md#nodejs-knockout-deploy-check-ins
require('nko')('tvIvWlrlsP5QwPsM');

var    http = require('http'),
         fs = require('fs'),
    express = require('express'),
     // config = require('config'),
       path = require('path'),
         io = require('socket.io');

var app = express();

var port = process.env.PORT || 3000;

app.set('port', port);

var sessOptions = {
  key: 'adalden-NKO',
  secret: 'tcndgy23cr875yfia.rpid345079pi80u9=c,h54df09.48rpich,3/9'
};

// all environments
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session(sessOptions));
app.use(app.router);
app.use(require('stylus').middleware(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// -+- Load all the routes -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
fs.readdirSync(__dirname + '/routes').forEach(function (file) {
  require('./routes/' + file)(app);
});

// -+- Create the Server -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
var server = http.createServer(app);

// -+- Load SocketIO -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
io = io.listen(server);
fs.readdirSync(__dirname + '/io').forEach(function (file) {
  require('./io/' + file)(io);
});

// -+- Start the Server +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
server.listen(app.get('port'), function (err) {
  if (err) { console.error(err); process.exit(-1); }

  // if run as root, downgrade to the owner of this file
  if (process.getuid() === 0) {
    require('fs').stat(__filename, function(err, stats) {
      if (err) { return console.error(err); }
      process.setuid(stats.uid);
    });
  }

  console.log('Express server listening on port ' + app.get('port'));
});


io.configure('production', function () {
  io.enable('browser client minification');  // send minified client
  io.enable('browser client etag');          // apply etag caching logic based on version number
  io.enable('browser client gzip');          // gzip the file
  io.set('log level', 1);                    // reduce logging

  // enable all transports (optional if you want flashsocket support, please note that some hosting
  // providers do not allow you to create servers that listen on a port different than 80 or their
  // default port)
  io.set('transports', [
    'websocket',
    'flashsocket',
    'htmlfile',
    'xhr-polling',
    'jsonp-polling'
  ]);
});



  // // http://blog.nodeknockout.com/post/35364532732/protip-add-the-vote-ko-badge-to-your-app
  // var voteko = '<iframe src="http://nodeknockout.com/iframe/adalden" frameborder=0 scrolling=no allowtransparency=true width=115 height=25></iframe>';

  // res.writeHead(200, {'Content-Type': 'text/html'});
  // res.end('<html><body>' + voteko + '</body></html>\n');
