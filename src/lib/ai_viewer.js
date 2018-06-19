
$(function(){

    var ai_data = [],
        ai_solutions = [];

    function SortByMMR(a, b){
        var aMMR = a.mmr;
        var bMMR = b.mmr; 
        return ((aMMR > bMMR) ? -1 : ((aMMR < bMMR) ? 1 : 0));
    }

	// Card object definition
    function AiSolution() {
        this.player_card_value;
        this.enemy_card_value;
        this.center_mod;
        this.enemy_mod;
        this.shield_mod;
        this.freeze_mod;
        this.rock_mod;
        this.mmr;

        this.createVisuals = function(){
            console.log('doing');
            jQuery('<div/>', {
                class: 'aiVisual',
                text: (this.player_card_value + ', ' + this.enemy_card_value + ', ' + this.center_mod + ', ' + this.enemy_mod + ', ' + this.shield_mod + ', ' + this.freeze_mod + ', ' + this.rock_mod + ', ' + this.mmr + '.')
            }).appendTo($('.aiList:first'));
        }
    }

	function seedSolutions(){
        for (var i = 0; i < ai_data.length; i++){
            // No duplicate found
            var newSolution = new AiSolution();
           // console.log(ai_data[i]);
            newSolution.player_card_value = ai_data[i].player_card_value;
            newSolution.enemy_card_value = ai_data[i].enemy_card_value;
            newSolution.center_mod = ai_data[i].center_mod;
            newSolution.enemy_mod = ai_data[i].enemy_mod;
            newSolution.shield_mod = ai_data[i].shield_mod;
            newSolution.freeze_mod = ai_data[i].freeze_mod;
            newSolution.rock_mod = ai_data[i].rock_mod;
            newSolution.mmr = ai_data[i].mmr;
            ai_solutions.push(newSolution);
        }

        for (var i = 0; i < ai_solutions.length; i++){
            for (var j = i + 1; j < ai_solutions.length; j++){
                // Check for duplicates
                console.log('i: ' + i + ', j: ' + j);
                console.log(ai_solutions[i].player_card_value + ', ' + ai_solutions[j].player_card_value);
                if (ai_solutions[i].player_card_value === ai_solutions[j].player_card_value &&
                    ai_solutions[i].enemy_card_value === ai_solutions[j].enemy_card_value &&
                    ai_solutions[i].center_mod === ai_solutions[j].center_mod &&
                    ai_solutions[i].enemy_mod === ai_solutions[j].enemy_mod &&
                    ai_solutions[i].shield_mod === ai_solutions[j].shield_mod &&
                    ai_solutions[i].freeze_mod === ai_solutions[j].freeze_mod &&
                    ai_solutions[i].rock_mod === ai_solutions[j].rock_mod){
                    //remove deplicate
                    ai_solutions.splice(j,1);
                    j--;
                }
            }
            ai_solutions[i].createVisuals();
        }
	}

    window.console.log("Starting");

    var file = 'json/ai.json';
    $.getJSON( file, function( data ) {
        //console.log(data);
        ai_data = data;
        ai_data.sort(SortByMMR);
        seedSolutions();
    });

    $( "#reduceAI" ).click(function( event ) {
        $('.aiList:first').html('');

        for (var i = 0; i < ai_solutions.length; i++){
            for (var j = i + 1; j < ai_solutions.length; j++){
                // Check for duplicates
                console.log('i: ' + i + ', j: ' + j);
                console.log(ai_solutions[i].player_card_value + ', ' + ai_solutions[j].player_card_value);
                if (ai_solutions[i].player_card_value === ai_solutions[j].player_card_value &&
                    ai_solutions[i].enemy_card_value === ai_solutions[j].enemy_card_value &&
                    ai_solutions[i].center_mod === ai_solutions[j].center_mod &&
                    ai_solutions[i].enemy_mod === ai_solutions[j].enemy_mod &&
                    ai_solutions[i].shield_mod === ai_solutions[j].shield_mod &&
                    ai_solutions[i].freeze_mod === ai_solutions[j].freeze_mod &&
                    ai_solutions[i].rock_mod === ai_solutions[j].rock_mod){
                    //remove deplicate
                    ai_solutions.splice(j,1);
                    j--;
                }
            }
            ai_solutions[i].createVisuals();
        }
    });

    $( "#evolveAI" ).click(function( event ) {
        var temp_solutions = [];

        for (var i = 0; i < ai_solutions.length / 2 + 1; i++) {
            temp_solutions.push(ai_solutions[i]);
        }

        for (var i = 0; i < ai_solutions.length / 2 + 1; i++) {
            var newSolution = [];

            if (Math.floor(Math.random() * 5) === 0) { //mutate
                newSolution = {
                    player_card_value : Math.floor((Math.random() * 100) + 1), // 10),  player_card_value = 1, // Default initialised AI variables
                    enemy_card_value : Math.floor((Math.random() * 100) + 1), // 10),   enemy_card_value = 1,
                    center_mod : Math.floor((Math.random() * 20) + 11) / 10, // 1.5),   center_mod = 1.5,
                    enemy_mod : Math.floor((Math.random() * 20) + 1) / 10, // 1.5),     enemy_mod = 1.5,
                    shield_mod : Math.floor((Math.random() * 20) + 11) / 10, // 1.3),   shield_mod = 1.3,
                    freeze_mod : Math.floor((Math.random() * 20) + 1) / 10, // 2),   freeze_mod = 0.2,
                    rock_mod : Math.floor((Math.random() * 20) + 1) / 10,
                    mmr : 1 // 4    rock_mod = 0.4;
                };
            } else {
                var slice_length = Math.floor(Math.random() * 7);
                var parent1  = ai_solutions[Math.floor(Math.random() * (ai_solutions.length / 2))];
                var parent2  = ai_solutions[Math.floor(Math.random() * (ai_solutions.length / 2))];
                newSolution = {
                    player_card_value : Math.floor(Math.random() * 2) === 0 ? parent1.player_card_value : parent2.player_card_value ,
                    enemy_card_value : Math.floor(Math.random() * 2) === 0 ? parent1.enemy_card_value : parent2.enemy_card_value ,
                    center_mod : Math.floor(Math.random() * 2) === 0 ? parent1.center_mod : parent2.center_mod ,
                    enemy_mod : Math.floor(Math.random() * 2) === 0 ? parent1.enemy_mod : parent2.enemy_mod ,
                    shield_mod : Math.floor(Math.random() * 2) === 0 ? parent1.shield_mod : parent2.shield_mod ,
                    freeze_mod : Math.floor(Math.random() * 2) === 0 ? parent1.freeze_mod : parent2.freeze_mod ,
                    rock_mod : Math.floor(Math.random() * 2) === 0 ? parent1.rock_mod : parent2.rock_mod,
                    mmr : 1
                };
            }

            temp_solutions.push(newSolution);
        }

        this.href = 'data:plain/text,' + JSON.stringify(temp_solutions);
    });
});