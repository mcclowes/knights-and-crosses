import { createRequire } from "module";

const require = createRequire(import.meta.url);
const cardResolver = require("./card-resolver.cjs");

export const resolveCard = cardResolver.resolveCard;
export const applyEffect = cardResolver.applyEffect;
export default cardResolver;
