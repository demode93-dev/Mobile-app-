import { ABILITY_BASE } from '../utils/constants.js';
import { playSFX } from './SoundManager.js';

// Resolves the effects of matched tiles against enemies, and enemy attacks
// against the hero, folding in whatever run modifiers (camp upgrades +
// permanent journal nodes) are currently active.
export default class CombatManager {
  constructor(scene, hero, getEnemies, modifiers) {
    this.scene = scene;
    this.hero = hero;
    this.getEnemies = getEnemies; // () => Enemy[]
    this.modifiers = modifiers; // merged stat/flag object, see UpgradeManager
    this.log = (msg) => scene.events.emit('log', msg);
    this.firstSwordUsedThisDepth = false;
    this.timeWarpUsedThisDepth = false;
    this.fireballUsedThisDepth = false;
  }

  livingEnemies() {
    return this.getEnemies().filter(e => !e.isDead);
  }

  resetDepthFlags() {
    this.firstSwordUsedThisDepth = false;
    this.timeWarpUsedThisDepth = false;
    this.fireballUsedThisDepth = false;
  }

  mod(key, fallback = 0) {
    return this.modifiers[key] !== undefined ? this.modifiers[key] : fallback;
  }

  // Finds the nearest enemy (or enemies, if tied) to the centroid of matched cells.
  findNearestEnemies(matchedCells) {
    const enemies = this.livingEnemies();
    if (enemies.length === 0) return [];
    const cRow = matchedCells.reduce((s, c) => s + c.row, 0) / matchedCells.length;
    const cCol = matchedCells.reduce((s, c) => s + c.col, 0) / matchedCells.length;
    let best = Infinity;
    let ties = [];
    for (const e of enemies) {
      const d = Math.abs(e.row - cRow) + Math.abs(e.col - cCol);
      if (d < best - 1e-6) {
        best = d;
        ties = [e];
      } else if (Math.abs(d - best) < 1e-6) {
        ties.push(e);
      }
    }
    return ties;
  }

  // ---------------------------------------------------------------------
  // Ability resolution. `chooseTarget` is an async function the caller
  // supplies to resolve ties (prompts the player to tap an enemy).
  // ---------------------------------------------------------------------
  async resolveAbility(color, ability, matchedCells, chooseTarget) {
    switch (ability) {
      case 'sword':
        return this.resolveSword(matchedCells, chooseTarget);
      case 'shield':
        return this.resolveShield();
      case 'magic':
        return this.resolveMagic(matchedCells);
      case 'potion':
        return this.resolvePotion();
      default:
        return null;
    }
  }

  async resolveSword(matchedCells, chooseTarget) {
    const candidates = this.findNearestEnemies(matchedCells);
    if (candidates.length === 0) return null;
    let target = candidates[0];
    if (candidates.length > 1) target = await chooseTarget(candidates);

    let damage = ABILITY_BASE.sword.damage + this.mod('swordDamage') + (this.modifiers.dungeonMaster ? 1 : 0);

    if (this.modifiers.berserkersVow) damage += 2;
    if (this.modifiers.executionerInstaKill && target.hp / target.maxHp <= 0.3) damage = target.hp;
    if (!this.firstSwordUsedThisDepth && this.modifiers.firstSwordDouble) {
      damage *= 2;
      this.firstSwordUsedThisDepth = true;
    }
    if (this.modifiers.batSwatter && target.type === 'bat') damage *= 2;

    const targets = [target];
    if (this.modifiers.doubleStrike) {
      const others = this.livingEnemies().filter(e => e !== target && e.isAdjacentTo(this.hero));
      if (others.length > 0) targets.push(others[0]);
    }

    playSFX(this.scene, 'sfx_sword');
    for (const t of targets) {
      this.strikeEnemy(t, damage, 'sword');
    }

    if (this.modifiers.purifyingStrike) this.hero.poisonStacks = 0;

    if (this.modifiers.elementalFury) {
      for (const t of targets) {
        if (t.isDead) {
          this.livingEnemies().filter(e => e.isAdjacentTo(t)).forEach(e => this.strikeEnemy(e, 1, 'magic'));
        }
      }
    }

    await this.repeatIfTimeWarp(() => targets.forEach(t => this.strikeEnemy(t, damage, 'sword')));
    return { ability: 'sword', targets, damage };
  }

  async resolveShield() {
    const block = ABILITY_BASE.shield.block + this.mod('shieldBlock') + (this.modifiers.dungeonMaster ? 1 : 0);
    const duration = 1 + this.mod('blockDurationBonus') + (this.modifiers.ironWall ? 1 : 0);
    this.hero.addBlock(block, duration);
    playSFX(this.scene, 'sfx_shield');
    this.log(`Shield tile grants ${block} Block.`);
    await this.repeatIfTimeWarp(() => this.hero.addBlock(block, duration));
    return { ability: 'shield', block };
  }

  async resolveMagic(matchedCells) {
    const enemies = this.livingEnemies();
    if (enemies.length === 0) return null;

    playSFX(this.scene, 'sfx_magic');
    let damage = ABILITY_BASE.magic.damage + this.mod('magicDamage') + (this.modifiers.dungeonMaster ? 1 : 0);
    if (this.modifiers.crossMagic) damage += 2;
    if (matchedCells.length >= 4 && this.modifiers.spellWeaving) damage *= 2;

    const cRow = Math.round(matchedCells.reduce((s, c) => s + c.row, 0) / matchedCells.length);
    const cCol = Math.round(matchedCells.reduce((s, c) => s + c.col, 0) / matchedCells.length);
    const horizontal = matchedCells.every(c => c.row === matchedCells[0].row);
    const lineLen = this.mod('magicLineLength', ABILITY_BASE.magic.lineLength);
    const half = Math.floor(lineLen / 2);

    const inLine = (e) => {
      if (this.modifiers.crossMagic) {
        return Math.abs(e.row - cRow) + Math.abs(e.col - cCol) <= half;
      }
      if (horizontal) return e.row === cRow && Math.abs(e.col - cCol) <= half;
      return e.col === cCol && Math.abs(e.row - cRow) <= half;
    };

    const targets = enemies.filter(inLine);
    for (const t of targets) {
      if (t.magicImmune && !this.modifiers.piercesWraithImmunity) {
        this.log('The Wraith shrugs off the magic!');
        continue;
      }
      this.strikeEnemy(t, damage, 'magic');
    }
    if (this.modifiers.arcaneEchoChance && Math.random() < this.modifiers.arcaneEchoChance) {
      for (const t of targets) if (!t.isDead) this.strikeEnemy(t, damage, 'magic');
    }
    await this.repeatIfTimeWarp(() => {
      for (const t of targets) if (!t.isDead) this.strikeEnemy(t, damage, 'magic');
    });
    return { ability: 'magic', targets, damage };
  }

  async resolvePotion() {
    let heal = ABILITY_BASE.potion.heal + this.mod('potionHeal') + (this.modifiers.dungeonMaster ? 1 : 0);
    let block = 0;
    if (this.modifiers.battlePriest) {
      heal += 2;
      block = 1;
    }
    const healed = this.hero.heal(heal);
    if (block) this.hero.addBlock(block, 1);
    playSFX(this.scene, 'sfx_potion');
    this.log(`Potion tile heals ${healed} HP.`);
    await this.repeatIfTimeWarp(() => this.hero.heal(heal));
    return { ability: 'potion', healed };
  }

  strikeEnemy(target, damage, source) {
    if (!target || target.isDead) return;
    const dealt = target.takeDamage(damage, source);
    if (target.type === 'cultist' && this.modifiers.cultistsBane && dealt > 0) {
      target.blockedFromHealing = true;
    }
    if (target.isDead) {
      this.scene.events.emit('enemyKilled', target);
      if (source === 'sword' && this.modifiers.vampiricEdge) this.hero.heal(1);
      if (this.modifiers.bloodlust) this.hero.heal(this.modifiers.bloodlust);
      if (source === 'magic' && this.modifiers.chainLightning) {
        const others = this.livingEnemies();
        if (others.length > 0) {
          const bounce = others[Math.floor(Math.random() * others.length)];
          this.strikeEnemy(bounce, Math.ceil(damage / 2), 'magic-bounce');
        }
      }
    }
    return dealt;
  }

  async repeatIfTimeWarp(fn) {
    if (!this.timeWarpUsedThisDepth && this.modifiers.timeWarp) {
      this.timeWarpUsedThisDepth = true;
      fn();
    }
  }

  castFireball() {
    if (this.fireballUsedThisDepth || !this.modifiers.fireball) return false;
    this.fireballUsedThisDepth = true;
    this.livingEnemies().forEach(e => this.strikeEnemy(e, 8, 'fireball'));
    this.log('Fireball erupts across the room!');
    return true;
  }

  dealDamageToHero(amount, source, message) {
    if (this.hero.isDead) return 0;
    let reduced = Math.max(0, amount - this.mod('damageReduction'));
    if (this.modifiers.damageCap) reduced = Math.min(reduced, this.modifiers.damageCap);

    const blockBefore = this.hero.block;
    const dealt = this.hero.applyDamage(reduced);
    const absorbedByBlock = blockBefore - this.hero.block;

    if (message) this.log(message);
    this.scene.events.emit('heroDamaged', dealt, source);

    if (absorbedByBlock > 0 && this.modifiers.retaliationDamage && source && typeof source.takeDamage === 'function' && !source.isDead) {
      this.strikeEnemy(source, this.modifiers.retaliationDamage, 'retaliation');
    }

    if (this.hero.isDead && !this.hero.deathEmitted) {
      this.hero.deathEmitted = true;
      this.scene.events.emit('heroDied');
    }
    return dealt;
  }
}
