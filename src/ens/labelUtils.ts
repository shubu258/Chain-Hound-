// Deterministic ENS label derivation for wallet addresses: `<adjective>-<noun>-<number>`, e.g.
// "brave-falcon-042" — short and pronounceable, so people can actually say/remember a wallet's
// name, instead of the raw 40-char hex address. Same address always yields the same label (for a
// given `salt`), so the same wallet is instantly recognizable by name wherever it shows up in the
// network (as a root, or as a counterparty under a different root).
//
// 64 adjectives * 64 nouns * 1000 numbers ≈ 4.1M possible labels — collision-free for all
// practical purposes at this project's scale, but not a mathematical guarantee, so callers MUST
// verify a "labels registered" state actually resolves to the wallet they expect before treating
// it as already-correctly-registered, and retry with an incremented `salt` on a genuine collision
// (see src/ens/ensRegistrar.ts's resolveLabelSlot).

import { keccak256, toBytes } from 'viem';

const ADJECTIVES = [
  'brave', 'swift', 'amber', 'silent', 'lucky', 'quiet', 'bold', 'calm',
  'eager', 'fierce', 'gentle', 'happy', 'jolly', 'keen', 'lively', 'merry',
  'noble', 'proud', 'quick', 'rapid', 'sharp', 'steady', 'tidy', 'vivid',
  'warm', 'wild', 'young', 'zesty', 'bright', 'clever', 'dapper', 'earnest',
  'faithful', 'grand', 'humble', 'iron', 'jovial', 'kindly', 'loyal', 'mighty',
  'nimble', 'orderly', 'plucky', 'quaint', 'robust', 'stellar', 'trusty', 'upbeat',
  'vast', 'wise', 'zealous', 'amiable', 'brisk', 'cosmic', 'daring', 'elegant',
  'frosty', 'golden', 'honest', 'inventive', 'jaunty', 'kinetic', 'lunar', 'magnetic',
];

const NOUNS = [
  'falcon', 'otter', 'comet', 'maple', 'harbor', 'ember', 'tiger', 'meadow',
  'raven', 'canyon', 'willow', 'badger', 'summit', 'coral', 'lynx', 'granite',
  'dune', 'heron', 'cedar', 'quartz', 'panther', 'ridge', 'sparrow', 'glacier',
  'basin', 'orchid', 'copper', 'pelican', 'thicket', 'boulder', 'lagoon', 'osprey',
  'terrace', 'juniper', 'cobalt', 'wolf', 'plateau', 'starling', 'reef', 'aspen',
  'delta', 'hawk', 'prairie', 'marble', 'brook', 'condor', 'valley', 'birch',
  'meridian', 'zephyr', 'crane', 'mesa', 'beacon', 'grove', 'talon', 'fjord',
  'orbit', 'spruce', 'kestrel', 'atoll', 'vertex', 'nebula', 'tundra', 'canvas',
];

function labelHashBytes(address: string, salt: number): Uint8Array {
  return toBytes(keccak256(toBytes(`${address.toLowerCase()}:${salt}`)));
}

/** `0xAbCd...1234` -> `brave-falcon-042` — a short, pronounceable, deterministic ENS label. */
export function addressToLabel(address: string, salt = 0): string {
  const bytes = labelHashBytes(address, salt);
  const adjective = ADJECTIVES[bytes[0] % ADJECTIVES.length];
  const noun = NOUNS[bytes[1] % NOUNS.length];
  const number = ((bytes[2] << 8) | bytes[3]) % 1000;
  return `${adjective}-${noun}-${String(number).padStart(3, '0')}`;
}

/** Builds the full ENS name for a label registered under `parentName`. */
export function buildEnsName(label: string, parentName: string): string {
  return `${label}.${parentName}`;
}
