import { solveOilChain } from './oilSolver';
import type { OilDemand, OilProductivity } from './oilSolver';

// The chain is solved in closed form, so these pin the algebra rather than a
// snapshot: each case asserts the relation productivity is meant to have, not
// just a number. See the derivation at the top of ./oilSolver.
//
// Each case picks a demand that isolates the effect under test — one where the
// smelter is the only coal user, say — and guards the quantity is actually live
// before checking how it moves, so a case can't pass by everything being zero.

const demand = (refinedOil: number, hydrogen: number, graphite: number): OilDemand =>
  ({ refinedOil, hydrogen, graphite });

const P = (plasma: number, arc: number): OilProductivity => ({ plasma, arc });

describe('solveOilChain baseline', () => {
  it('meets an oil-only demand from plasma, reforming the spare hydrogen back to oil', () => {
    // 60 oil, no hydrogen wanted: plasma makes both, reforming turns the
    // unwanted hydrogen back into oil. 3p = R + H = 60, so p = 20; crude = 2p.
    const s = solveOilChain(demand(60, 0, 0));
    expect(s.plasma).toBeCloseTo(20);
    expect(s.reformed).toBeCloseTo(20);
    expect(s.xray).toBeCloseTo(0);
    expect(s.crudeOil).toBeCloseTo(40);
    expect(s.coal).toBeCloseTo(20);          // 1 coal per reformed craft
  });

  it('smelts a graphite-only demand from coal in the fewest-buildings mode', () => {
    const s = solveOilChain(demand(0, 0, 60), 'buildings');
    expect(s.arcGraphite).toBeCloseTo(60);   // 1 graphite per smelter craft
    expect(s.coal).toBeCloseTo(120);         // 2 coal per craft
    expect(s.crudeOil).toBeCloseTo(0);
  });

  it('returns nothing for empty demand, whatever the productivity', () => {
    const s = solveOilChain(demand(0, 0, 0), 'buildings', P(1.25, 1.25));
    expect(s).toEqual({
      plasma: 0, xray: 0, reformed: 0, arcGraphite: 0,
      crudeOil: 0, coal: 0, surplusGraphite: 0,
    });
  });

  it('defaults to no productivity when the argument is omitted', () => {
    const d = demand(60, 30, 40);
    expect(solveOilChain(d, 'mixed')).toEqual(solveOilChain(d, 'mixed', P(1, 1)));
  });
});

describe('plasma productivity', () => {
  it('cuts plasma crafts and crude in proportion to 1/Pp', () => {
    const d = demand(30, 60, 0);
    const base = solveOilChain(d);
    const prol = solveOilChain(d, 'buildings', P(1.25, 1));
    expect(prol.plasma).toBeCloseTo(base.plasma / 1.25);
    expect(prol.crudeOil).toBeCloseTo(base.crudeOil / 1.25);
    // The closed form: crude = 2(R + H) / (3 Pp).
    expect(prol.crudeOil).toBeCloseTo((2 * (30 + 60)) / (3 * 1.25));
  });

  it('leaves the swing untouched — cracking and reforming are unchanged', () => {
    const d = demand(30, 60, 0);              // swing +30, so cracking runs
    const base = solveOilChain(d);
    const prol = solveOilChain(d, 'buildings', P(1.25, 1));
    expect(base.xray).toBeCloseTo(30);        // guard: the swing is live
    expect(prol.xray).toBeCloseTo(base.xray);
    expect(prol.reformed).toBeCloseTo(base.reformed);
  });

  it('does not touch reforming coal', () => {
    const d = demand(60, 0, 0);               // swing -20, so reforming runs
    const base = solveOilChain(d);
    const prol = solveOilChain(d, 'buildings', P(1.25, 1));
    expect(base.coal).toBeCloseTo(20);        // guard: coal is live
    expect(prol.coal).toBeCloseTo(base.coal);
  });
});

describe('arc productivity', () => {
  it('cuts smelter crafts and its coal in proportion to 1/Pa', () => {
    const d = demand(0, 0, 60);               // pure smelter: all coal is the arc's
    const base = solveOilChain(d, 'buildings');
    const prol = solveOilChain(d, 'buildings', P(1, 1.25));
    expect(prol.arcGraphite).toBeCloseTo(base.arcGraphite / 1.25);
    expect(prol.coal).toBeCloseTo(base.coal / 1.25);
  });

  it('leaves plasma and crude alone', () => {
    const d = demand(60, 0, 60);              // plasma and smelter both run
    const base = solveOilChain(d, 'buildings');
    const prol = solveOilChain(d, 'buildings', P(1, 1.25));
    expect(base.plasma).toBeCloseTo(20);      // guard: plasma is live
    expect(prol.plasma).toBeCloseTo(base.plasma);
    expect(prol.crudeOil).toBeCloseTo(base.crudeOil);
    expect(prol.arcGraphite).toBeCloseTo(base.arcGraphite / 1.25);  // it did act
  });

  it('is irrelevant once cracking covers the graphite and the smelter is off', () => {
    // Resource mode pushes all graphite onto the cracker, so arc = 0 and its
    // productivity has nothing to divide.
    const off = solveOilChain(demand(0, 0, 60), 'resource', P(1, 1.25));
    expect(off.arcGraphite).toBeCloseTo(0);
    expect(off.coal).toBeCloseTo(solveOilChain(demand(0, 0, 60), 'resource').coal);
  });
});

describe('the two multipliers are independent', () => {
  it('applies both at once without interfering', () => {
    const d = demand(60, 0, 60);
    const base = solveOilChain(d, 'buildings');
    const both = solveOilChain(d, 'buildings', P(1.25, 1.25));
    expect(both.crudeOil).toBeCloseTo(base.crudeOil / 1.25);        // plasma only
    expect(both.arcGraphite).toBeCloseTo(base.arcGraphite / 1.25);  // arc only
    // Coal is reforming (unchanged) plus the smelter (scaled by 1/Pa), not a
    // flat scale of the total.
    expect(both.coal).toBeCloseTo(base.reformed + (base.coal - base.reformed) / 1.25);
  });
});
