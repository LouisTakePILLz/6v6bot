// @flow

import type GameSession from '~/GameSession'
import type { MongoClient } from 'mongodb'

import * as errors from '~/errors'
import * as utils from '~/utils'
import { gameRules, gameRuleValueTypes } from '~/gameRules'

type Rule = {|
  value?: ?any,
  enabled?: boolean
|}

const GameRuleManagerWrapper = (env: { db: MongoClient }) => class GameRuleManager {
  gameSession: GameSession
  rules: Map<string, Rule>

  constructor(gameSession: GameSession) {
    this.gameSession = gameSession
  }

  async getRules() {
    if (this.rules != null) {
      return this.rules
    }

    this.rules = new Map()

    const query = { guildId: this.gameSession.guild.id, cmdChannelId: this.gameSession.cmdChannel.id }

    try {
      const cur = await env.db.collection('gamerules').find(query)
      const docs = await cur.toArray()

      for (const doc of docs) {
        const normalizedRuleName = doc.ruleName.toLowerCase()
        if (gameRules[normalizedRuleName] != null) {
          this.rules.set(normalizedRuleName, { enabled: doc.enabled, value: doc.value })
        }
      }
    } catch (err) {
      console.log('getRules ERROR', err)
      throw err
    }

    return this.rules
  }

  async getRule(ruleName: string) {
    const normalizedRuleName = ruleName.toLowerCase()
    const defaultRule = gameRules[normalizedRuleName]

    if (defaultRule == null) {
      throw new errors.InvalidGameRuleError(ruleName)
    }

    const rule = (await this.getRules()).get(normalizedRuleName)
    if (rule != null) {
      return { ...defaultRule, ...rule }
    }

    return defaultRule
  }

  async isEnabled(ruleName: string) {
    const rule = await this.getRule(ruleName)
    return rule.enabled == null ? rule.defaultEnabled : rule.enabled
  }

  async setEnabled(ruleName: string, value: boolean) {
    const normalizedRuleName = ruleName.toLowerCase()
    const defaultRule = gameRules[normalizedRuleName]

    if (defaultRule == null) {
      throw new errors.InvalidGameRuleError(ruleName)
    }

    const boolValue = utils.stringToBoolean(value)
    if (boolValue == null) {
      throw new errors.InvalidGameRuleValueError(defaultRule.type, value)
    }

    const rules = await this.getRules()
    rules.set(normalizedRuleName, { ...rules.get(normalizedRuleName), enabled: boolValue })

    const query = {
      guildId: this.gameSession.guild.id,
      cmdChannelId: this.gameSession.cmdChannel.id,
      ruleName: defaultRule.ruleName
    }

    try {
      await env.db.collection('gamerules').update(query, { $set: { enabled: boolValue } }, { upsert: true })
    } catch (err) {
      console.log('setEnabled DB ERROR', err)
      throw new errors.DbError(err)
    }
  }

  async setRule(ruleName: string, value: any) {
    const rule = await this.getRule(ruleName)

    if (typeof (rule.validate) === 'function') {
      rule.validate(value)
    }

    if (rule.type === gameRuleValueTypes.boolean) {
      await this.setEnabled(ruleName, value)
      return
    }

    if (rule.type === gameRuleValueTypes.string) {
      rule.value = value
    } else if (rule.type === gameRuleValueTypes.number) {
      rule.value = Number(value)
    } else if (rule.type === gameRuleValueTypes.integer) {
      rule.value = Number(value) | 0
    } else {
      throw new Error(`Unsupported rule type: ${rule.type && rule.type.name}`)
    }

    (await this.getRules()).set(rule.ruleName, { enabled: rule.enabled, value: rule.value })

    const query = {
      guildId: this.gameSession.guild.id,
      cmdChannelId: this.gameSession.cmdChannel.id,
      ruleName: rule.ruleName
    }

    try {
      await env.db.collection('gamerules').update(query, { $set: { enabled: true, value: rule.value } }, { upsert: true })
    } catch (err) {
      console.log('setRule DB ERROR', err)
      throw new errors.DbError(err)
    }
  }
}

export default GameRuleManagerWrapper
