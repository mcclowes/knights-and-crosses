var gameport        = process.env.PORT || 4004,
    address         = '',

    io              = require('socket.io'),
    express         = require('express'),
    UUID            = require('node-uuid'),

    verbose         = false,
    http            = require('http'),
    app             = express(),
    server          = http.createServer(app);

/* Express server set up. */

//Tell the server to listen for incoming connections
require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    address = add;
    server.listen(gameport, address);
    console.log('\t :: Express :: Listening on ' + address + ':' + gameport );

})

//By default, we forward the / path to index.html automatically.
app.get( '/', function( req, res ){
    console.log('trying to load %s', __dirname + '/index.html');
    res.sendFile( '/index.html' , { root:__dirname });
});

//This handler will listen for requests on /*, any file from the root of our server.
app.get( '/*' , function( req, res, next ) {
    var file = req.params[0]; // Current file they have requested
    if(verbose) console.log('\t :: Express :: file requested : ' + file); //For debugging, we can track what files are requested.
    res.sendFile( __dirname + '/' + file ); //Send the requesting client the file.
}); //app.get *

/* Socket.IO server set up. */
//Express and socket.io can work together to serve the socket.io client files for you.
//This way, when the client requests '/socket.io/' files, socket.io determines what the client needs.
var sio = io.listen(server, {
    'log level'     : 0,
    'authorization' : function (handshakeData, callback) {
        callback(null, true); // error first callback style
    }
} );

//Enter the game server code. The game server handles client connections looking for a game, creating games, leaving games, joining games and ending games when they leave.
game_server = require('./game.server.js');

//Socket.io will call this function when a client connects, so we can send that client looking for a game to play,
//as well as give that client a unique ID to use so we can maintain the list if players.
sio.sockets.on('connection', function (client) {
    //Generate a new UUID, looks something like 5b2ca132-64bd-4513-99da-90e838ca47d1 and store this on their socket/connection
    client.userid = UUID();
    // Tell player they connected, giving them their id
    client.emit('onconnected', { id: client.userid } );
    //now we can find them a game to play with someone. If no game exists with someone waiting, they create one and wait.
    game_server.findGame(client);

    //Useful to know when someone connects
    console.log('\t socket.io:: player ' + client.userid + ' connected');

    //Now we want to handle some of the messages that clients will send. They send messages here, and we send them to the game_server to handle.
    client.on('message', function(m) {
        game_server.onMessage(client, m);
    }); //client.on message

    //When this client disconnects, we want to tell the game server about that as well, so it can remove them from the game they are
    //in, and make sure the other player knows that they left and so on.
    client.on('disconnect', function () {
        //Useful to know when soomeone disconnects
        console.log('\t socket.io:: client disconnected ' + client.userid + ' ' + client.game_id);
        
        //If the client was in a game, set by game_server.findGame, we can tell the game server to update that game state.
        if(client.game && client.game.id) {
            game_server.endGame(client.game.id, client.userid); //player leaving a game should destroy that game
        } //client.game_id
    }); //client.on disconnect
}); //sio.sockets.on connection