/**
 * Shuffles an array using the Fisher-Yates algorithm
 * @param array The array to shuffle
 * @returns The shuffled array
 */
export function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Scales a number with an exponent, handling negative numbers correctly
 * @param base The base number
 * @param exp The exponent
 * @returns The scaled number
 */
export function scaleNumber(base: number, exp: number): number {
    return base < 0 ? -Math.pow(Math.abs(base), exp) : Math.pow(base, exp);
}

/**
 * Creates an array of cards from card data
 * @param data Array of card data
 * @returns Array of created cards
 */
export function createCardArray<T>(data: T[]): any[] {
    return data.map(item => createCard(item));
}

/**
 * Creates a single card from card data
 * @param data Card data
 * @returns Created card
 */
export function createCard(data: any): any {
    return data.cardName !== undefined ? new GameCard(data.cardName) : new GameCard(data);
}

/**
 * Polyfill for requestAnimationFrame
 */
export function setupAnimationFrame(): void {
    const vendors = ['ms', 'moz', 'webkit', 'o'];
    let lastTime = 0;

    for (let i = 0; i < vendors.length && !global.requestAnimationFrame; i++) {
        global.requestAnimationFrame = global[`${vendors[i]}RequestAnimationFrame`];
        global.cancelAnimationFrame = global[`${vendors[i]}CancelAnimationFrame`] || 
                                   global[`${vendors[i]}CancelRequestAnimationFrame`];
    }

    if (!global.requestAnimationFrame) {
        global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
            const currTime = Date.now();
            const timeToCall = Math.max(0, 16 - (currTime - lastTime));
            const id = global.setTimeout(() => {
                callback(currTime + timeToCall);
            }, timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!global.cancelAnimationFrame) {
        global.cancelAnimationFrame = (id: number): void => {
            clearTimeout(id);
        };
    }
} 