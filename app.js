/* ----------------------- Variables ------------------------- */

var io              = require('socket.io').listen(3013),
    UUID            = require('node-uuid'),
    gameport        = process.env.PORT || 3014,
    address         = 'http://localhost',
    express         = require('express'),
    verbose         = false,
    http            = require('http'),
    app             = express(),
    server          = http.createServer(app),
    game_server     = require('./game.server.js'),
    sio             = '';

/* ----------------------- Find IP, start listening ------------------------- */

try {
    require('dns').lookup(require('os').hostname(), function (err, add, fam) {
        server.listen(gameport, add);
        address = add;
        //Log something so we know that it succeeded.
        console.log('\t :: Express :: Listening on ' + add + ', on port ' + gameport );

        /* ----------------------- File request handling ------------------------- */

        app.get( '/', function( req, res ){
            console.log('trying to load %s', __dirname + '/index.html');
            res.sendFile( '/index.html' , { root:__dirname });
        });

        app.get( '/*' , function( req, res, next ) {
            var file = req.params[0]; // Current file they have requested
            if(verbose) console.log('\t :: Express :: file requested : ' + file); //For debugging, we can track what files are requested.
            res.sendFile( __dirname + '/' + file ); //Send the requesting client the file.
        });

        sio = io.listen(server); // Handle socket.io file request
    })
} catch (err) {
    server.listen(gameport)
}

//Tell the server to listen for incoming connections
console.log('\t :: Express :: Listening on ' + address + ':' + gameport );


/* ----------------------- Handle connection -----------------------  */

// Handle successful connection
io.sockets.on('connection', function (client) {
    client.userid = UUID(); //Generate new user ID
    console.log(client.userid);
    client.emit('onconnected', { id: client.userid } ); // Ping successful connect
    console.log('\t socket.io:: player ' + client.userid + ' connected');

    game_server.findGame(client);

    // Forward user messages to server
    client.on('message', function(m) {
        game_server.onMessage(client, m);
    });

    // Handle user disconnect
    client.on('disconnect', function () {
        console.log('\t socket.io:: client disconnected ' + client.userid);
        //If the client was in a game, set by game_server.findGame, we can tell the game server to update that game state.
        if ( client.game && client.game.id ) {
            game_server.endGame(client.game.id, client.userid); //player leaving a game should destroy that game
        } // client.game_id
    }); // client.on disconnect
}); // io.sockets.on connection
