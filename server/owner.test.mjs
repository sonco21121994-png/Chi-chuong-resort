import { isOwnerNick, ownerSetFrom } from '../js/owner.js';

const set = ownerSetFrom(['SonCo5G']);
const yes = ['SonCo5G', 'sonco5g', 'SONCO5G', ' SonCo5G '];
const no = ['SonCo', 'SonCo5', 'Son Co 5G', '', null, 'Khách'];
for (const n of yes) if (!isOwnerNick(set, n)) throw new Error('should own: ' + JSON.stringify(n));
for (const n of no) if (isOwnerNick(set, n)) throw new Error('should not own: ' + JSON.stringify(n));
if (!isOwnerNick(set, null, 'sonco5g')) throw new Error('account nick should match when display name is empty');
if (isOwnerNick(ownerSetFrom([]), 'SonCo5G') !== true) throw new Error('empty list falls back to SonCo5G');
if (isOwnerNick(ownerSetFrom(['Khác']), 'SonCo5G')) throw new Error('explicit list replaces the default');
console.log('owner nick ok');
