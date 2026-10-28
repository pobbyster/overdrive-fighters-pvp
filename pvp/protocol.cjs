'use strict';
// The network boundary never accepts an engine snapshot or internal payment flags.
const clone = x => structuredClone(x);
const variable = {
  mulligan: ['hand', 'energy'], block: ['uids'], prepare: ['slot'],
  chooseEnergy: ['uids'], chooseOwnEnergy: ['uids'], orderTriggers: ['ids'], orderDiscard: ['uids']
};
function playerTarget(action) {
  return action.type === 'balanceTarget' || action.type === 'rivalsChoose' && 'target' in action || action.type === 'remainingChoose' && 'target' in action;
}
function mapAction(action, seat) {
  const a = clone(action);
  if (playerTarget(a) && seat === 1) a.target = 1 - a.target;
  if (a.type === 'orderDiscard' && a.options && seat === 1) a.options = {0: a.options[1], 1: a.options[0]};
  return a;
}
function command(engine, seat, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Jogada inválida.');
  const a = mapAction(input, seat), extra = variable[a.type] || [];
  const legal = engine.legalActions(seat).find(option => {
    const fixed = Object.keys(option).filter(k => !['options', 'required', ...extra].includes(k));
    return fixed.every(k => JSON.stringify(option[k]) === JSON.stringify(a[k])) &&
      Object.keys(a).every(k => fixed.includes(k) || extra.includes(k) || k === 'selectEnergy' || k === 'options' || k === 'required');
  });
  if (!legal) throw Error('Jogada indisponível nesta janela.');
  const result = Object.fromEntries(Object.entries(legal).filter(([k]) => !['options', 'required', ...extra].includes(k)));
  for (const k of extra) if (a[k] !== undefined) result[k] = clone(a[k]);
  // All additional choices are performed through the engine's own choice protocol.
  if (['play', 'block', 'replenish', 'fighterSkill', 'startSkill', 'balanceDiscard', 'expansionMournerSkill', 'expansionPlacideSkill', 'expansionExcalium'].includes(a.type)) result.selectEnergy = true;
  return result;
}
function project(engine, seat, names) {
  const v = clone(engine.view(seat)), s = engine.s, index = p => seat === 1 && [0, 1].includes(p) ? 1 - p : p;
  for (const key of ['active', 'priority', 'winner']) v[key] = index(v[key]);
  v.viewer = 0; v.preparedTurn = !!s.preparedTurn;
  for (const list of [v.stack, v.combats, v.completed]) for (const item of list) item.p = index(item.p);
  // No history payload, deck ordering, random seed, pending intent, or replay crosses this boundary.
  delete v.history;
  if (v.choice) {
    v.choice.player = index(v.choice.player);
    v.choice.index = s.choice.index;
    if (v.choice.cause?.payer !== undefined) v.choice.cause.payer = index(v.choice.cause.payer);
  }
  const candidates = v.choice?.player === 0 ? (s.choice.uids || []).map(uid => engine.find(uid)).filter(Boolean).map(f => ({p:index(f.p), z:f.z, card:f.p!==seat&&f.z==='extra'&&!f.card.public&&f.card.publicUntil!==s.turn?{uid:f.card.uid,hidden:true,slot:f.card.slot,ready:f.card.ready}:clone(f.card)})) : [];
  v.players = [v.players[seat], v.players[1-seat]];
  v.players.forEach((side, local) => {
    const real = local === 0 ? seat : 1-seat;
    side.name = names[real]; side.mulligan = s.players[real].mulligan;
    // Synthetic backs have no correspondence to the opponent's real hand or either deck.
    side.deck = Array.from({length:side.deckCount}, (_,i) => ({uid:`back-deck-${local}-${i}`,hidden:true}));
    if (local === 1) side.hand = Array.from({length:side.handCount}, (_,i) => ({uid:`back-hand-${i}`,hidden:true}));
    for (const zone of ['hand','stamina','extra','arena','discard','banished','revealedHand','deckContents']) for (const card of side[zone]||[]) if (card.owner !== undefined) card.owner = index(card.owner);
    side.fighter.owner = local;
  });
  for (const f of candidates) if (f.card.owner !== undefined) f.card.owner = index(f.card.owner);
  v.actions = v.actions.map(a => mapAction(a, seat));
  v.log = v.log.slice(-200).map(l => ({...l,text:l.text.replace(/Você|IA/g, name => names[name === 'Você' ? 0 : 1])}));
  const costs = {}, reasons = {};
  for (const a of engine.legalActions(seat).filter(a => a.type === 'play')) costs[[a.uid,a.mode,a.x||0,...(a.mode==='guardStrike'?[a.zone]:[])].join(':')] = engine.payment(seat,engine.find(a.uid).card,a.mode,a.x,a.zone);
  for (const c of [v.players[0].fighter,...v.players[0].hand,...v.players[0].extra,...v.players[0].stamina,...v.players[0].discard]) reasons[c.uid] = engine.explainCard(seat,c.uid);
  const guardCosts=Object.fromEntries(engine.usable(seat).filter(c=>engine.def(c).type==='Guarda').map(c=>[c.uid,engine.guardCost(seat,c)]));
  return {sounds:engine.soundEvents||[],view:v,candidates,costs,reasons,guardCosts,summary:engine.describeCombat(seat)};
}
module.exports = {command,project,mapAction};
