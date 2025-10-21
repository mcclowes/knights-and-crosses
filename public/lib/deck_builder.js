
$(function(){

    var deck = [];
    var cards = [];

    function SortByName(a, b){
        var aName = a.toLowerCase();
        var bName = b.toLowerCase(); 
        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
    }

    function ChosenCard() {
        this.cardName = '';

        this.addCard = function(){
            window.console.log(deck);

            this.cardBody = jQuery('<div/>', {
                class: 'cardSelector'
            });

            jQuery('<div/>', {
                class: this.cardName,
                text: this.cardName
            }).appendTo(this.cardBody);

            var targetCardSelector = this;
            $(this.cardBody[0]).click(function(){
                targetCardSelector.cardBody.remove();
                delete targetCardSelector;
            });

            function cardMatch(card){
                var x = 0;

                for (var i = 0; i < deck.length; i++){
                    window.console.log(deck[i] + ', ' + card.cardName);
                    if (deck[i] === card.cardName) {
                        x++;
                    }
                }

                return x;
            };

            var cardCount = cardMatch(this);

            window.console.log(cardCount);
            if (cardCount != 0) { //already in deck
                if (cardCount <= 4){
                    targetCardSelector.cardBody.remove();
                    delete targetCardSelector;
                    $('.' + this.cardName, deck).addClass(cardCount++);
                } else { //too many already
                    window.alert("Card limit reached for this card");
                }
            } else {
                deck.push(this.cardName);
                deck.sort(SortByName);
                $('.cardList:first').append(this.cardBody);
            }
        }

    };

	// Card object definition
    function Card() {
        this.cardName = '';
        this.cardEffects = [];
        this.cardImage = '';
        this.cardBody = '';
        this.cardAvgValue = '';
        this.cardMinValue = '';
        this.cardMaxValue = '';

        //Activates card's effects
        this.chooseCard = function(targetCard){
            window.console.log($(this));

            var newCard = new ChosenCard();
            newCard.cardName = targetCard.cardName;
            newCard.addCard();
            
        };

        this.createCard = function(){
            this.cardBody = jQuery('<div/>', {
                class: 'card drawn spaced ' + this.cardName.toLowerCase().split(' ').join('_')
            });

            jQuery('<div/>', {
                class: 'cardName',
                text: this.cardName
            }).appendTo(this.cardBody);

            jQuery('<div/>', {
                class: 'cardEffects',
                text: this.cardEffects.join([separator = '. ']) + '.'
            }).appendTo(this.cardBody);

            jQuery('<div/>', {
                class: 'cardAvgValue',
                text: this.cardAvgValue
            }).appendTo(this.cardBody);
            
            jQuery('<div/>', {
                class: 'cardMinValue',
                text: this.cardMinValue
            }).appendTo(this.cardBody);

            jQuery('<div/>', {
                class: 'cardMaxValue',
                text: this.cardMaxValue
            }).appendTo(this.cardBody);

            var targetCard = this; //closure
            $(this.cardBody[0]).click(function(){
                targetCard.chooseCard(targetCard);
            });
            
            $('.cardPool:first').append(this.cardBody);
        };
    }


	function seedCards(){

        for (var i = 0; i < cards.length; i++){
            var newCard = new Card();
            newCard.cardName = cards[i].name;
            newCard.cardEffects = cards[i].effects;
            newCard.cardAvgValue = (cards[i].total / cards[i].count).toFixed(0);
            newCard.cardMinValue = cards[i].min;
            newCard.cardMaxValue = cards[i].max;
            window.console.log(newCard);
            newCard.createCard();
        }

	}

    function loadDeck(jsonArray){

        for (var i = 0; i < jsonArray; i++){
            var newCard = new ChosenCard();
            newCard.cardName = jsonArray[i];
            newCard.addCard();
        }

    }

    window.console.log("Starting");

    var file = 'json/card_data.json';
    $.getJSON( file, function( data ) {
        console.log(data);
        cards = data;
        /*for (var i = 0; i < data.length; i++) {
            //cards.push(data[i]);

        }*/
        seedCards();

        console.log(cards);
    });

    $( "#save" ).click(function( event ) {
        var temp_deck = [];

        for (var i = 0; i < deck.length; i++) {
            temp_deck.push(deck[i]);
        }

        window.console.log(temp_deck);

        this.href = 'data:plain/text,' + JSON.stringify(temp_deck);
    });

    $( "#load" ).change(function( event ) {
        var fr = new FileReader();
        fr.onload = function(){
            var dataURL = fr.result;
            window.console.log(dataUrl);
            var output = document.getElementById('output');
            output.src = dataURL;
        }
        var jsonArray = fr.readAsText(this.files[0]);

        loadDeck(jsonArray);
    });

});