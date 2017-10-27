import * as errors from '~/errors'
import * as utils from '~/utils'
import defaultRuleSet from '~/gameRules'

const GameRuleManagerWrapper = env => class GameRuleManager {
  constructor() {
    this.rules = new Map()
  }

  getRule(ruleName) {
    return this.rules.get(ruleName)
  }

  isEnabled(ruleName) {
    const ruleNode = this.getRule(ruleName)
    if (ruleNode == null) {
      if (defaultRuleSet[ruleName] == null) {
        return false
      }

      return defaultRuleSet[ruleName].enabled
    }

    return ruleNode.enabled
  }

  setRule(rule, value) {
    const defaultRule = defaultRuleSet[rule]
    if (defaultRule.type === Boolean) {
      const boolValue = utils.stringToBoolean(value)
      if (boolValue == null) {
        throw new errors.InvalidGameRuleValue(boolValue)
      }

      // TODO: store values
    }

    // TODO: add more value types
  }
}

export default GameRuleManagerWrapper
