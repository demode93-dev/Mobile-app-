import { GRID_SIZE, ENEMY_ACT_ORDER } from '../utils/constants.js';
import { MIMIC_STATE } from '../entities/Mimic.js';

// Orchestrates a full turn: tile selection/swap, match + cascade resolution,
// the enemy phase (in fixed act order), and status-effect ticks. Emits
// scene events so GameScene only has to react to state changes, not drive them.
export default class TurnManager {
  constructor(scene, { board, hero, combatManager, upgradeManager, getEnemies }) {
    this.scene = scene;
    this.board = board;
    this.hero = hero;
    this.combatManager = combatManager;
    this.upgradeManager = upgradeManager;
    this.getEnemies = getEnemies;
    this.selected = null;
    this.busy = false;
    this.quickReflexesUsedThisDepth = false;
    this.pendingChoice = null;
  }

  resetDepthFlags() {
    this.quickReflexesUsedThisDepth = false;
    this.combatManager.resetDepthFlags();
    this.checkInitialMimicAmbush();
  }

  checkInitialMimicAmbush() {
    for (const e of this.getEnemies()) {
      if (e.type === 'mimic' && e.state === MIMIC_STATE.DISGUISED) {
        e.checkAmbush(this.hero, this.combatManager);
      }
    }
  }

  log(msg) {
    this.scene.events.emit('log', msg);
  }

  async handleTileTap(row, col) {
    if (this.busy || this.hero.isDead) return;
    const board = this.board;

    if (!this.selected) {
      if (board.isBlocked(row, col)) return;
      this.selected = { row, col };
      this.scene.events.emit('tileSelected', this.selected);
      return;
    }

    if (this.selected.row === row && this.selected.col === col) {
      this.selected = null;
      this.scene.events.emit('tileDeselected');
      return;
    }

    const a = this.selected;
    const b = { row, col };
    this.selected = null;
    this.scene.events.emit('tileDeselected');

    if (!board.areAdjacent(a, b)) {
      // Tapping a non-adjacent tile just re-selects it instead of attempting an invalid swap.
      if (!board.isBlocked(row, col)) {
        this.selected = { row, col };
        this.scene.events.emit('tileSelected', this.selected);
      }
      return;
    }

    this.busy = true;
    try {
      await this.attemptSwap(a, b);
    } finally {
      this.busy = false;
    }
  }

  // Tournament-run move recording. No-op (and negligible cost) outside a
  // Daily Dungeon run - see GameScene.init()'s isTournamentRun/moveHistory
  // and GameScene.recordMove().
  recordMove(entry) {
    this.scene.recordMove(entry);
  }

  async attemptSwap(a, b) {
    const sourceColor = this.board.colorAt(a.row, a.col);
    const result = this.board.trySwap(a, b);
    if (!result) return;

    if (!result.success) {
      // No match: "color" falls back to the tile that was actually being moved.
      this.recordMove({ type: 'swap', from: [a.row, a.col], to: [b.row, b.col], matched: false, color: sourceColor, abilityTriggered: null });
      const freeRedo = this.upgradeManager.modifiers.quickReflexes && !this.quickReflexesUsedThisDepth;
      await this.board.animateSwap(a, b, true);
      if (freeRedo) {
        this.quickReflexesUsedThisDepth = true;
        this.log('Quick Reflexes: that failed swap was free.');
        return;
      }
      this.log('No match - the turn passes.');
      await this.runEnemyPhase();
      return;
    }

    // Matched: "color" is the color that actually formed the match (and thus
    // matches abilityTriggered), not the moved tile's own pre-swap color -
    // those can differ, since the OTHER swapped tile is what completes the run.
    const matchedColor = result.firstMatches.length > 0 ? result.firstMatches[0].color : sourceColor;
    const primaryAbility = result.firstMatches.length > 0 ? this.board.abilityForColor(matchedColor) : null;
    this.recordMove({ type: 'swap', from: [a.row, a.col], to: [b.row, b.col], matched: true, color: matchedColor, abilityTriggered: primaryAbility });
    await this.board.animateSwap(a, b, false);
    await this.resolveMatchChain(result.firstMatches);
    await this.runEnemyPhase();
  }

  async resolveMatchChain(groups) {
    let currentGroups = groups;
    while (currentGroups && currentGroups.length > 0) {
      for (const group of currentGroups) {
        const ability = this.board.abilityForColor(group.color);
        if (!ability) continue; // brown / no-ability tiles
        const outcome = await this.combatManager.resolveAbility(group.color, ability, group.cells, (candidates) => this.chooseTarget(candidates));
        if (outcome) {
          if (outcome.targets && outcome.targets.length > 0) {
            for (const t of outcome.targets) {
              this.recordMove({ type: outcome.ability, target: t.type, value: outcome.damage });
            }
          } else if (outcome.ability === 'shield') {
            this.recordMove({ type: 'shield', target: 'hero', value: outcome.block });
          } else if (outcome.ability === 'potion') {
            this.recordMove({ type: 'potion', target: 'hero', value: outcome.healed });
          }
        }
        if (outcome && outcome.targets && outcome.targets.length > 0) {
          await this.moveHeroNear(outcome.targets[0]);
        }
        this.checkDepthCleared();
        if (this.hero.isDead) return;
      }
      currentGroups = await this.board.resolveMatches(currentGroups);
    }
  }

  chooseTarget(candidates) {
    return new Promise((resolve) => {
      this.log('Choose a target!');
      const cleanups = [];
      const finish = (enemy) => {
        cleanups.forEach(fn => fn());
        resolve(enemy);
      };
      for (const enemy of candidates) {
        const pulse = this.scene.tweens.add({ targets: enemy.sprite, scale: { from: 0.7, to: 0.85 }, duration: 300, yoyo: true, repeat: -1 });
        const handler = () => finish(enemy);
        enemy.sprite.once('pointerdown', handler);
        cleanups.push(() => { pulse.stop(); enemy.sprite.setScale(0.7); enemy.sprite.off('pointerdown', handler); });
      }
    });
  }

  async moveHeroNear(enemy) {
    if (!enemy || enemy.isDead) return;
    const occupied = new Set(this.getEnemies().filter(e => !e.isDead).map(e => `${e.row},${e.col}`));
    const candidates = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = enemy.row + dr;
      const c = enemy.col + dc;
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && !occupied.has(`${r},${c}`)) {
        candidates.push({ r, c, dist: Math.abs(r - this.hero.row) + Math.abs(c - this.hero.col) });
      }
    }
    if (candidates.length === 0) return;
    candidates.sort((x, y) => x.dist - y.dist);
    const { r, c } = candidates[0];
    if (r === this.hero.row && c === this.hero.col) return;
    this.hero.moveTo(r, c);
    await new Promise(res => this.scene.time.delayedCall(260, res));
    this.checkInitialMimicAmbush();
  }

  async runEnemyPhase() {
    if (this.hero.isDead) return;
    this.scene.turnCount = (this.scene.turnCount || 0) + 1;
    this.scene.events.emit('enemyPhaseStart');
    const occupied = new Set(this.getEnemies().filter(e => !e.isDead).map(e => `${e.row},${e.col}`));
    const poisonImmune = !!this.upgradeManager.modifiers.poisonImmune;
    const cultistsBaneActive = !!this.upgradeManager.modifiers.cultistsBane;

    for (const type of ENEMY_ACT_ORDER) {
      const actors = this.getEnemies().filter(e => e.type === type && !e.isDead);
      for (const actor of actors) {
        if (this.hero.isDead) break;
        actor.act({
          hero: this.hero,
          enemies: this.getEnemies().filter(e => !e.isDead),
          combatManager: this.combatManager,
          occupied,
          log: (m) => this.log(m),
          poisonImmune,
          cultistsBaneActive
        });
        await new Promise(res => this.scene.time.delayedCall(180, res));
      }
    }

    if (!this.hero.isDead) {
      const dmgReduction = this.upgradeManager.modifiers.damageReduction || 0;
      const blockAbsorbs = !!this.upgradeManager.modifiers.blockAbsorbsPoison;
      if (blockAbsorbs && this.hero.block > 0 && this.hero.poisonStacks > 0) {
        const absorbed = Math.min(this.hero.block, this.hero.poisonStacks);
        this.hero.block -= absorbed;
        this.hero.poisonStacks -= absorbed;
      }
      const poisonDealt = this.hero.applyPoisonTick(dmgReduction);
      if (poisonDealt > 0) this.log(`Poison courses through you for ${poisonDealt}.`);
      this.hero.decayBlock();
    }

    this.scene.events.emit('enemyPhaseEnd');
    this.checkGameOver();
  }

  checkDepthCleared() {
    const anyAlive = this.getEnemies().some(e => !e.isDead);
    if (!anyAlive) {
      this.scene.events.emit('depthCleared');
    }
  }

  checkGameOver() {
    if (this.hero.isDead && !this.hero.deathEmitted) {
      this.hero.deathEmitted = true;
      this.scene.events.emit('heroDied');
    }
  }
}
