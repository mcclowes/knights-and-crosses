import { GameCore } from '../core/GameCore';
import { state } from '../config/constants';

export class GamePlayer {
    public host: boolean;
    public state: string;
    public hand: any[];
    public deck: any[];
    public discard: any[];

    constructor(private game: GameCore, isHost: boolean) {
        this.host = isHost;
        this.state = 'connecting';
        this.hand = [];
        this.deck = [];
        this.discard = [];
    }

    public getPlayerValue(): number {
        return this.host ? state.PLAYER_ONE : state.PLAYER_TWO;
    }

    public drawCard(): void {
        if (this.deck.length > 0) {
            const card = this.deck.pop();
            if (card) {
                this.hand.push(card);
            }
        }
    }

    public discardCard(cardIndex: number): void {
        if (cardIndex >= 0 && cardIndex < this.hand.length) {
            const card = this.hand.splice(cardIndex, 1)[0];
            if (card) {
                this.discard.push(card);
            }
        }
    }

    public hasCards(): boolean {
        return this.hand.length > 0;
    }

    public getHandSize(): number {
        return this.hand.length;
    }

    public getDeckSize(): number {
        return this.deck.length;
    }

    public getDiscardSize(): number {
        return this.discard.length;
    }

    public isTurnComplete(): boolean {
        // Add logic for turn completion
        return true;
    }

    public resetState(): void {
        this.state = 'connecting';
        this.hand = [];
        this.deck = [];
        this.discard = [];
    }
} 