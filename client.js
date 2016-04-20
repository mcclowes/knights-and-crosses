//A window global for our game root variable.
var game = {};

//When loading, we store references to our drawing canvases, and initiate a game instance.
window.onload = function(){
	game = new game_core(); // Create game
	
	game.viewport = document.getElementById('viewport');
	game.viewport.width = game.world.width; //Adjust canvas size
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
	// Handle click
	game.ctx.canvas.addEventListener('click', function(e) { 
		if (game.players.self.host === true && game.turn === -1) { // not players turn
			return;
		} else if (game.players.self.host === false && game.turn === 1) { // not players turn (can condense)
			return;
		}

		var mx = event.clientX,
			my = event.clientY,
			shapes = [game.board];
			shapes = shapes.concat(game.end_turn_button, game.players.self.hand);

		for (var i = shapes.length - 1; i >= 0; i--) { // Check all clickable objects
		  	if (shapes[i].contains(mx, my)) {
		  		var input = '';

		  		if (shapes[i] === game.board) {
		  			if (game.players.self.player_state.pieces_to_play > 0 || game.players.self.player_state.destroyingA > 0 || game.players.self.player_state.destroyingE > 0 || game.players.self.player_state.destroyingS > 0 || game.players.self.player_state.damagingA > 0 || game.players.self.player_state.damagingE > 0 || game.players.self.player_state.damagingS > 0 || game.players.self.player_state.thawing > 0 || game.players.self.player_state.blocking > 0 || game.players.self.player_state.shielding > 0 || game.players.self.player_state.deshielding > 0) {
		  				input = 'sq-' + (100 + mx - game.board.x).toString()[0] + (100 + my - game.board.y).toString()[0];
		  			}
		  		} else if (shapes[i] === game.end_turn_button) {
		  			input = 'en'
		  		} else {
		  			if (game.players.self.player_state.cards_to_play > 0 || game.players.self.player_state.discarding > 0) {
		  				input = 'ca-' + shapes[i].cardName;
		  			}
		  		}
				// Process input
				game.input_seq += 1;
				//Send inputs
				var server_packet = 'i.' + input + '.' + game.local_time.toFixed(3).replace('.','-') + '.' + game.input_seq;
				game.socket.send( server_packet );

				return;
			}
		}
	}, true);

	//Start game update loop
	game.update( new Date().getTime() );
}; //window.onload
