// @flow

import type GameSession from '~/GameSession'
import type { MongoClient } from 'mongodb'

import * as errors from '~/errors'
import * as utils from '~/utils'
import defaultGameRules from '~/gameRules'

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
        if (defaultGameRules[doc.ruleName] != null) {
          this.rules.set(doc.ruleName, { enabled: doc.enabled, value: doc.value })
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
    const defaultRule = defaultGameRules[normalizedRuleName]

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
    const defaultRule = defaultGameRules[normalizedRuleName]

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
      ruleName
    }

    try {
      await env.db.collection('gamerules').update(query, { $set: { enabled: boolValue } }, { upsert: true })
    } catch (err) {
      console.log('setRule DB ERROR', err)
      throw new errors.DbError(err)
    }
  }

  async setRule(ruleName: string, value: any) {
    const normalizedRuleName = ruleName.toLowerCase()
    const defaultRule = defaultGameRules[normalizedRuleName]

    if (defaultRule == null) {
      throw new errors.InvalidGameRuleError(ruleName)
    }

    if (typeof (defaultRule.validate) === 'function') {
      defaultRule.validate(value)
    }

    const rules = await this.getRules()

    if (defaultRule.type === Boolean) {
      await this.setEnabled(normalizedRuleName, value)
    } else if (defaultRule.type === String) {
      rules.set(normalizedRuleName, { ...rules.get(normalizedRuleName), value })
      await this.setEnabled(normalizedRuleName, true)
    } else {
      throw new Error(`Unsupported rule type: ${defaultRule.type && defaultRule.type.name}`)
    }
  }
}

export default GameRuleManagerWrapper
