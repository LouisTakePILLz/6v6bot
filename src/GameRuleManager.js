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
        this.rules.set(doc.ruleName, { enabled: doc.enabled, value: doc.value })
      }
    } catch (err) {
      console.log('getRules ERROR', err)
      throw err
    }

    return this.rules
  }

  async getRule(ruleName: string) {
    return (await this.getRules()).get(ruleName)
  }

  async isEnabled(ruleName: string) {
    const ruleNode = await this.getRule(ruleName)
    if (ruleNode == null) {
      if (defaultGameRules[ruleName] == null) {
        return false
      }

      return defaultGameRules[ruleName].enabled
    }

    return ruleNode.enabled
  }

  async setEnabled(ruleName: string, value: boolean) {
    const defaultRule = defaultGameRules[ruleName]

    if (defaultRule == null) {
      throw new errors.InvalidGameRuleError(ruleName)
    }

    const boolValue = utils.stringToBoolean(value)
    if (boolValue == null) {
      throw new errors.InvalidGameRuleValueError(defaultRule.type, value)
    }

    const rules = await this.getRules()
    rules.set(ruleName, { enabled: boolValue })

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
    const defaultRule = defaultGameRules[ruleName]
    if (defaultRule == null) {
      throw new errors.InvalidGameRuleError(ruleName)
    }

    if (typeof (defaultRule.validate) === 'function') {
      defaultRule.validate(value)
    }

    if (defaultRule.type === Boolean) {
      await this.setEnabled(ruleName, value)
    } else {
      throw new Error(`Unsupported rule type: ${defaultRule.type && defaultRule.type.name}`)
    }
  }
}

export default GameRuleManagerWrapper
