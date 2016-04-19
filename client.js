//A window global for our game root variable.
var game = {};

//When loading, we store references to our drawing canvases, and initiate a game instance.
window.onload = function(){
	//Create our game client instance.
	game = new game_core();
	//Fetch the viewport (canvas)
	game.viewport = document.getElementById('viewport');
	//Adjust canvas size
	game.viewport.width = game.world.width;
	game.viewport.height = game.world.height;

	game.ctx = game.viewport.getContext('2d');//Fetch the rendering contexts
	game.ctx.font = '11px "Helvetica"'; //Set the draw style for the font

	// Handle mouse events
	game.ctx.canvas.addEventListener('selectstart', function(e) { e.preventDefault(); return false; }, false); // Prevent highlighting text
	// Handle mouse over cards
	game.ctx.canvas.addEventListener('mousemove', function(e) {
		var mx = event.clientX,
			my = event.clientY;

		for (var i = game.players.self.hand.length - 1; i >= 0; i--) { // Check all clickable objects
		  	if (game.players.self.hand[i].contains(mx, my)) {
				game.players.self.hand[i].draw(true);
				return;
			}
		}
	}, true);
	// Click detection (Only type of interaction)
	game.ctx.canvas.addEventListener('click', function(e) { 
		if (game.players.self.host === true && game.turn === -1) { // not players turn
			return;
		} else if (game.players.self.host === false && game.turn === 1) { // not players turn (can condense)
			return;
		}

		var mx = event.clientX,
			my = event.clientY,
			shapes = [game.board];
		shapes = shapes.concat(game.end_turn_button, game.players.self.hand/*, game.players.other.hand*/); // create array of all clickable objects

		for (var i = shapes.length - 1; i >= 0; i--) { // Check all clickable objects
			//window.console.log(shapes[i].contains(mx, my));
		  	if (shapes[i].contains(mx, my)) {
		  		input = '';
		  		if (shapes[i] === game.board) {
		  			if (game.players.self.player_state.pieces_to_play > 0) {
		  				input = 'sq-' + (100 + mx - game.board.x).toString()[0] + (100 + my - game.board.y).toString()[0];
		  			}
		  		} else if (shapes[i] === game.end_turn_button) {
		  			input = 'en'
		  		} else {
		  			if (game.players.self.player_state.cards_to_play > 0 || game.players.self.player_state.discarding > 0) {
		  				input = 'ca-' + shapes[i].cardName;
		  			}
		  		}
				var mySel = shapes[i];

				window.console.log('pushing clicked input > ' + input);

				// Process input
				game.input_seq += 1;
				game.players.self.inputs.push({
					inputs : input,
					time : game.local_time.fixed(3),
					seq : game.input_seq
				});
				//Send inputs
				var server_packet = 'i.';
					server_packet += input + '.';
					server_packet += game.local_time.toFixed(3).replace('.','-') + '.';
					server_packet += game.input_seq;

				game.socket.send( server_packet );

				return;
			}
		}
	}, true);

	//Start game update loop
	game.update( new Date().getTime() );
}; //window.onload
