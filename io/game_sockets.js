/*******************************************************************************
 * WRITTEN BY: RICHIE PREECE
 * WRITTEN FOR: NODE KNOCKOUT 2013
 * TEAM: ADALDEN
 * TEAM MEMBERS: RICHIE PREECE, DALLIN OSMUN, JUSTIN PERMANN
 ******************************************************************************/

/* jshint node:true */
'use strict';

var _ = require('underscore');
var moment = require('moment');
var mainIO;

var currTimeout;

module.exports = function (io) {
  mainIO = io;
  io.sockets.on('connection', connect);
};

var start = undefined;
var flags = {};
var users = {};
var teams = {
  a: {
    points: 0,
    kills: 0,
    shots: 0,
    stole: 0,
    deaths: 0,
    ffire: 0,
    users: {}
  },
  b: {
    points: 0,
    kills: 0,
    shots: 0,
    stole: 0,
    deaths: 0,
    ffire: 0,
    users: {}
  }
};
var game = {
  started: false,
  countdown: false,
  connected: 0,
  active: 0,
  points: 0,
  kills: 0,
  shots: 0,
  stole: 0,
  deaths: 0,
  ffire: 0,
  teams: teams
};

function countdown(togo){ //togo is seconds
  if(togo == 0){
    game.started = true;
    game.countdown = false;
    mainIO.sockets.emit('go');
    start = moment();
    gameleft(15);
  } else {
    mainIO.sockets.emit('countdown', {
      sec: togo
    });
    currTimeout = setTimeout(countdown, 1000, togo - 1);
  }
}

function gameleft(togo){ //togo is minutes
  if(togo == 0){
    start = undefined;
    stopGame();

    game.countdown = true;
    countdown(5);
  } else {
    mainIO.sockets.emit('togo', {
      min: togo
    });
    currTimeout = setTimeout(gameleft, 1000 * 60, togo - 1);
  }
}

function stopGame(){
  clearTimeout(currTimeout);
  game.started = false;
  game.countdown = false;
  mainIO.sockets.emit('stop', game);
  resetGame();
}

function resetGame(){
  flags = {};

  _.each(game, function(element, index, list){
    if(typeof element === 'number' && index != 'active'){
      list[index] = 0;
    }
  })

  _.each(users, function(user){
    _.each(user, function(element, index, list){
      if(typeof element === 'number' && index != 'id'){
        list[index] = 0;
      }
    });
  });

  _.each(teams, function(team){
    _.each(team, function(element, index, list){
      if(typeof element === 'number'){
        list[index] = 0;
      }
    });
  });

  game.connected = game.active;
}

function getID(){
  var id = -1;

  do{
    id = Math.floor(Math.random() * 999);
  } while(users[id]);

  return id;
}

function assignTeam(){
  if(_.keys(teams.a.users).length < _.keys(teams.b.users).length){
    return 'a';
  } else {
    return 'b';
  }
}

function connect(socket) {
  var time = undefined;
  if(start){
    var diff = (15 * 60) - moment().diff(start, 'seconds');
    var mins = Math.floor(diff / 60);
    var secs = diff % 60;

    time = {
      min: mins,
      sec: secs
    };
  }

  var id = getID();
  var team = assignTeam();
  var user = {
    id: id,
    team: team,
    points: 0,
    kills: 0,
    shots: 0,
    stole: 0,
    deaths: 0,
    ffire: 0
  };

  ++game.connected;

  if(++game.active >= 2 && !game.countdown && !game.started){
    game.countdown = true;
    countdown(5);
  }

  socket.emit('conn', {
    team: user.team,
    go: game.started,
    teams: {
      a: {
        points: teams.a.points,
        kills: teams.a.kills,
        users: teams.a.users,
        flag: flags.a
      },
      b: {
        points: teams.b.points,
        kills: teams.b.kills,
        users: teams.b.users,
        flag: flags.b
      }
    },
    time: time
  });


  teams[team].users[id] = user;
  users[id] = user;

  socket.emit('msg', {
    id: -1,
    name: 'Admin',
    msg: 'Welcome to CTF Pro! Press "t" to chat!'
  });

  socket.emit('msg', {
    id: -1,
    name: 'Admin',
    msg: 'Like the game? Please vote for us at the bottom of the screen!'
  });

  socket.broadcast.emit('new', {
    id: user.id,
    team: team
  });

  function alert(msg){
    mainIO.sockets.emit('alert', {
      id: user.id,
      team: team,
      msg: msg
    });
  }

  function adminChat(msg){
    mainIO.sockets.emit('msg', {
      id: -1,
      admin: 'Admin',
      msg: msg
    });
  }

  socket.on('disconnect', function(){
    adminChat(user.nickname + ' has left the game');

    socket.broadcast.emit('dis', {
      id: user.id
    });

    if(--game.active < 2){
      stopGame();
    }

    if(flags[team] && flags[team].id && flags[team].id === user.id){
      socket.broadcast.emit('drop', {
        id: user.id,
        x: user.x,
        y: user.y
      });

      flags[team] = {
        x: user.x,
        y: user.y
      };

      alert((user.nickname || user.id) + ' has dropped the flag!');
    }

    delete teams[team].users[user.id];
    delete users[user.id];
  });

  socket.on('move', function(data){
    if(data.x === undefined) return;
    if(data.y === undefined) return;

    user.x = data.x;
    user.y = data.y;

    socket.broadcast.volatile.emit('pos', {
      id: user.id,
      x: user.x,
      y: user.y
    });
  });

  socket.on('point', function(){
    ++user.points;
    ++teams[team].points;
    ++game.points;

    var result = {
      id: user.id,
      a: teams.a.points,
      b: teams.b.points
    };

    delete flags[user.team];

    alert((user.nickname || user.id) + ' has captured the flag!');

    socket.emit('point', result);
    socket.broadcast.emit('point', result);

    if (teams[team].points === 3){
      stopGame();
      game.countdown = true;
      countdown(5);
    }
  });

  socket.on('shot', function(data){
    if(data.x === undefined) return;
    if(data.y === undefined) return;
    if(data.d === undefined) return;
    data.id = user.id;

    ++user.shots;
    ++teams[team].shots;
    ++game.shots;

    socket.broadcast.emit('shot', data);
  });

  socket.on('died', function(data){
    if(!data.id) return;

    if(user.team == users[data.id].team){
      //Friendly fire
      ++users[data.id].ffire;
      ++teams[users[data.id].team].ffire;
      ++game.ffire;
    } else {
      //Legit kill
      ++users[data.id].kills;
      ++teams[users[data.id].team].kills;
      ++game.kills;
    }

    ++user.deaths;
    ++teams[team].deaths;
    ++game.deaths;

    mainIO.sockets.emit('kills', {
      a: game.teams.a.kills,
      b: game.teams.b.kills
    });

    adminChat((users[data.id].nickname || users[data.id].id) + ' killed ' + (user.nickname || user.id));
  });

  socket.on('got', function(){
    ++user.stole;
    ++teams[team].stole;
    ++game.stole;

    socket.broadcast.emit('got', {
      id: user.id,
      team: team
    });

    flags[team] = {
      id: user.id
    };

    alert((user.nickname || user.id) + ' has stolen the flag!');
  });

  socket.on('drop', function(data){
    if(data.x === undefined) return;
    if(data.y === undefined) return;

    socket.broadcast.emit('drop', {
      id: user.id,
      x: data.x,
      y: data.y
    });

    flags[team] = {
      x: data.x,
      y: data.y
    };

    alert((user.nickname || user.id) + ' has dropped the flag!');
  });

  socket.on('return', function(data){
    socket.broadcast.emit('return', {
      id: user.id,
      team: team
    });

    var enemyTeam = team === 'a' ? 'b' : 'a';
    delete flags[enemyTeam];

    alert((user.nickname || user.id) + ' has returned the flag!');
  });

  socket.on('chat', function(data){
    if (!data.msg) return;

    var msg = {
      id: user.id,
      name: user.nickname,
      team: team,
      msg: data.msg
    };

    if (msg.msg.indexOf('/setNick ') === 0){
      var oldNick = user.nickname || user.id;
      var newNick = msg.msg.replace('/setNick ', '');
      msg.msg = oldNick + ' is now known as ' + newNick;
      msg.nick = newNick;

      if (!user.nickname){
        socket.broadcast.emit('msg', {
          id: -1,
          name: 'Admin',
          msg: 'Welcome to ' + newNick
        });
      } else {
        socket.broadcast.emit('msg', {
          id: -1,
          name: 'Admin',
          msg: msg.msg
        });
      }

      user.nickname = newNick;
      return socket.broadcast.emit('msg', msg);
    }

    socket.emit('msg', msg);
    socket.broadcast.emit('msg', msg);
  });
}
