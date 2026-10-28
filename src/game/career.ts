export type Stage = 'reg1' | 'reg2' | 'reg3' | 'semi' | 'final' | 'done';
export type SquadId = 0 | 1 | 2;

export interface Career {
  team: SquadId;
  throw: number;
  speed: number;
  catch: number;
  coins: number;
  stage: Stage;
  wins: number;
  losses: number;
  halves: 60 | 120 | 180;
  season: number;
}

export const SQUADS = [
  { id: 'grove', name: 'GROVE', jersey: '#3dcc6a', shorts: '#145c30', skin: '#f0c29a' },
  { id: 'tide', name: 'TIDE', jersey: '#3c7dff', shorts: '#17356e', skin: '#e7b48a' },
  { id: 'ember', name: 'EMBER', jersey: '#ef4d4d', shorts: '#7a2020', skin: '#f2c6a4' },
] as const;

const NEXT: Record<Exclude<Stage, 'done'>, Stage> = {
  reg1: 'reg2',
  reg2: 'reg3',
  reg3: 'semi',
  semi: 'final',
  final: 'done',
};

export function newCareer(team: SquadId): Career {
  return {
    team,
    throw: 0,
    speed: 0,
    catch: 0,
    coins: 0,
    stage: 'reg1',
    wins: 0,
    losses: 0,
    halves: 120,
    season: 1,
  };
}

export function opponentIndex(team: SquadId, stage: Stage): SquadId {
  const step = stage === 'reg2' || stage === 'semi' ? 2 : 1;
  return ((team + step) % 3) as SquadId;
}

export function stageLabel(stage: Stage): string {
  if (stage === 'reg1' || stage === 'reg2' || stage === 'reg3') {
    const n = stage === 'reg1' ? '1' : stage === 'reg2' ? '2' : '3';
    return `WEEK ${n}`;
  }
  if (stage === 'semi') return 'PLAYOFF';
  if (stage === 'final') return 'FINAL';
  return 'SEASON OVER';
}

export function reward(userGoals: number, won: boolean): number {
  return (won ? 40 : 16) + userGoals * 8;
}

export function upgradeCost(level: number): number {
  return [30, 60, 120][level] ?? 999;
}

export function applyResult(career: Career, userGoals: number, oppGoals: number): Career {
  const won = userGoals > oppGoals;
  const next = career.stage === 'done' ? 'done' : NEXT[career.stage];
  return {
    ...career,
    wins: career.wins + (won ? 1 : 0),
    losses: career.losses + (won ? 0 : 1),
    coins: career.coins + reward(userGoals, won),
    stage: next,
  };
}

export function buyUpgrade(career: Career, stat: 'throw' | 'speed' | 'catch'): Career {
  const level = career[stat];
  if (level >= 3) return career;
  const cost = upgradeCost(level);
  if (career.coins < cost) return career;
  return { ...career, coins: career.coins - cost, [stat]: level + 1 };
}

export function newSeason(career: Career): Career {
  return { ...career, stage: 'reg1', wins: 0, losses: 0, season: career.season + 1 };
}

const KEY = 'disc-runner-career';

export function loadCareer(): Career | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Career;
    if (parsed.team !== 0 && parsed.team !== 1 && parsed.team !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCareer(career: Career): void {
  localStorage.setItem(KEY, JSON.stringify(career));
}
