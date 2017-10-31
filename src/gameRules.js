import * as errors from '~/errors'

/* eslint guard-for-in: 0 */

function transformGameRules(rules) {
  const newRules = {}
  for (const ruleName in rules) {
    const rule = rules[ruleName]
    newRules[ruleName.toLowerCase()] = {
      ...rule,
      ruleName,
      defaultEnabled: rule.enabled,
      defaultValue: rule.value
    }
  }

  return newRules
}

const types = {
  boolean: 0,
  string: 1,
  number: 2,
  integer: 3
}

export const gameRules = transformGameRules({
  randomLeaders: {
    type: types.boolean,
    helpText: 'Picks random team leaders upon intializing a new game session (during setup)',
    enabled: true
  },
  autoStart: {
    type: types.boolean,
    helpText: 'Automatically starts the game session upon reaching the team member limit',
    enabled: true
  },
  maxTeamMembers: {
    type: types.integer,
    helpText: 'Controls the number of teammates that can be picked on each team (excludes the team leader)',
    enabled: true,
    value: 5,
    validate(value) {
      if (value <= 0) {
        throw new errors.GameruleValidationError('the value has to be greater than 0')
      }
    }
  },
  ow_mysteryHeroes: {
    type: types.boolean,
    helpText: 'Selects random heroes upon starting the game',
    enabled: false
  },
  /*
  ow_mysteryComps: {
    type: types.boolean,
    helpText: 'Selects random (standard) team compositions upon starting the game'
  },
  */
  ow_noLimits: {
    type: types.boolean,
    helpText: 'Controls whether multiple of the same heroes can be picked',
    enabled: false
  }
})

export const gameRuleValueTypes = types
